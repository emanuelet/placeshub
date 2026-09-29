type ApiBinding = { fetch(request: Request): Promise<Response> }

export async function onRequest({
  request,
  env,
}: {
  request: Request
  env: { API?: ApiBinding }
}): Promise<Response> {
  if (!env.API) {
    return Response.json({ error: 'API service binding is not configured' }, { status: 503 })
  }

  return env.API.fetch(request)
}
