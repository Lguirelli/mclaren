export async function withStartupTimeout(operation, label, milliseconds = 60000) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' excedeu o tempo de preparação')),milliseconds);})
    ]);
  } finally { clearTimeout(timer); }
}
