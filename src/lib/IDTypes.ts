// clientがserverとのcallbackを識別するためのID
export interface ClientJobID {
  clicmid?: number; // client callback manager id
}

// serverがlauncherとのcallbackを識別するためのID
export interface LauncherQueryID {
  request_id?: string; // launcher callback manager id
  // user_id? : string; // equal to socketid
}
