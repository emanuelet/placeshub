const extensionApi = globalThis.browser ?? globalThis.chrome

extensionApi.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== 'READ_GOOGLE') return
  const urls = message.urls
  if (
    !Array.isArray(urls) ||
    urls.length > 100 ||
    urls.some((url) => {
      try {
        const parsed = new URL(url)
        return (
          parsed.origin !== location.origin ||
          ![
            '/locationhistory/preview/mas',
            '/maps/preview/entitylist/getlist',
            '/maps/preview/place',
          ].includes(parsed.pathname)
        )
      } catch {
        return true
      }
    })
  ) {
    respond({ error: 'Invalid Maps request' })
    return
  }
  const read = Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) throw new Error(`Google Maps returned ${response.status}`)
      return response.text()
    }),
  )
  if (globalThis.browser) {
    return read.then(
      (responses) => ({ responses }),
      (error) => ({ error: String(error) }),
    )
  }
  read.then(
    (responses) => respond({ responses }),
    (error) => respond({ error: String(error) }),
  )
  return true
})
