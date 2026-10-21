// Uncompressed asset sizes avoid compressed Content-Length discrepancies.
const sizes = {"mclaren":6954840,"hanging-light":2190092,"industrial-light":5214452};
export function createLoadingProgress(update) {
  const fractions = Object.fromEntries(Object.keys(sizes).map(key=>[key,0]));
  const total = Object.values(sizes).reduce((a,b)=>a+b,0);
  let previous = 0;
  const publish = (value,label) => {
    previous = Math.max(previous,Math.min(100,Math.max(0,Math.floor(value))));
    update(previous,label);
  };
  return {
    asset(key,event) {
      if (!(key in sizes)) return;
      const loaded = Number.isFinite(event.loaded) ? Math.max(0,event.loaded) : 0;
      fractions[key] = Math.max(fractions[key],event.complete ? 1 : Math.min(.99,loaded/sizes[key]));
      publish(90*Object.keys(sizes).reduce((sum,key)=>sum+sizes[key]*fractions[key],0)/total,'Carregando modelos e texturas');
    },
    preparing() { publish(95,'Abrindo a cena 3D'); },
    complete() { publish(100,'Cena pronta'); }
  };
}
