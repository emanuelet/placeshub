export function validateConnection(address, key) {
  let url
  try {
    url = new URL(address.trim())
  } catch {
    throw new Error('Enter the PlacesHub origin only (https://host)')
  }
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    /[?#]/.test(address.trim()) ||
    url.search ||
    url.hash
  ) {
    throw new Error('Enter the PlacesHub origin only (https://host)')
  }
  const token = key.trim()
  if (!/^phs_[a-f0-9-]{72}$/.test(token)) throw new Error('Paste the extension key from PlacesHub')
  return { appUrl: url.origin, token }
}
