export function attachWikipediaPopup(el, getCurrent){
  if(!el) return;
  el.onclick = ()=>{
    const c = getCurrent();
    if(!c) return;
    const url = "https://en.wikipedia.org/wiki/"+encodeURIComponent(c.country);
    open(url,"_blank","noopener,noreferrer,width=900,height=700");
  };
}
