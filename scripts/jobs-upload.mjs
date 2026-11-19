import { createHash, randomUUID } from 'node:crypto';

// Keep small files on the existing fast path. Large submissions use the same
// v1 job response, but only an interrupted chunk needs to cross the network again.
export async function uploadJob(endpoint, form, headers, timeoutMs = 600000) {
  const file = form.get('file');
  const url = new URL(endpoint);
  const id = headers['Idempotency-Key'] || randomUUID();
  const send = (target,init) => fetch(target,{...init,headers:{...headers,...init.headers},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  const legacy = () => send(endpoint,{method:'POST',body:form});
  if (!file || file.size <= 2*1024*1024) return legacy();
  const base = new URL('/api/intake/v1/jobs/uploads',url);
  const options = Object.fromEntries([...form].filter(([name])=>name !== 'file'));
  const init = await send(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uploadId:id,fileName:file.name,fileSize:file.size,operation:url.pathname.split('/').pop(),options})});
  if (init.status === 404 || init.status === 405) return legacy();
  if (!init.ok) return init;
  const state = await init.json();
  if (state.uploadId !== id || !Number.isSafeInteger(state.chunkSize) || state.chunkSize < 1) throw new Error('Invalid upload session');
  const session = `${base}/${id}`;
  const complete = new Map(state.chunks.map(c=>[c.idx,c.sha256]));
  async function repeat(target, opts) {
    try { const res = await send(target,opts); if (![502,503,504,408].includes(res.status)) return res; await res.body?.cancel(); }
    catch (error) { if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error; }
    try { return await send(target,opts); }
    catch(error) { throw new Error(`Upload interrupted at ${new URL(target).pathname}; resume with upload_id=${id}: ${error.cause?.code || error.message}`); }
  }
  for(let n=0;n<Math.ceil(file.size/state.chunkSize);n++) {
    const chunk = file.slice(n*state.chunkSize,(n+1)*state.chunkSize);
    if(complete.has(n)) {
      if(createHash('sha256').update(new Uint8Array(await chunk.arrayBuffer())).digest('hex') !== complete.get(n)) throw new Error('Upload ID belongs to different file contents');
      continue;
    }
    const res = await repeat(`${session}/chunks/${n}`,{method:'PUT',body:chunk});
    if(!res.ok) return res;
    await res.body?.cancel();
  }
  return repeat(`${session}/commit`,{method:'POST'});
}
