// Busca la portada de cada libro por título usando la API local
async function fetchCover(title) {
  const res = await fetch(`/api/cover?title=${encodeURIComponent(title)}`);
  if (res.ok) {
    const data = await res.json();
    return data.url;
  }
  return '/placeholder.png';
}

document.addEventListener('DOMContentLoaded', async () => {
  const imgs = document.querySelectorAll('img[data-title]');
  imgs.forEach(async (img) => {
    const title = img.getAttribute('data-title').replace(/\.[^.]+$/, ''); // quita .pdf
    const url = await fetchCover(title);
    img.src = url;
  });
});
