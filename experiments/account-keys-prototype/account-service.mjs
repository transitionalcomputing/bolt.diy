/** Nonproduction server-internal facade. Never serialize resolveForProvider output. */
export function createAccountService({auth,vault}) {
  return Object.freeze({
    status:request=>vault.status(request),
    async save(request,key){await auth.requireMutation(request);return vault.save(request,key)},
    async remove(request){await auth.requireMutation(request);return vault.remove(request)},
    // Only a server-owned fixed OpenAI provider call may consume this result.
    resolveForProvider:request=>vault.resolveForProvider(request),
  });
}
