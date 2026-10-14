export type AccessState = "checking" | "signedOut" | "authenticating" | "guest" | "authenticated";

export function accessPermissions(access: AccessState) {
  return {
    application: access === "guest" || access === "authenticated",
    localData: access === "guest",
    privateApi: access === "authenticated",
    panelActions: access === "guest" || access === "authenticated",
    documentAnalysis: access === "authenticated",
  };
}
