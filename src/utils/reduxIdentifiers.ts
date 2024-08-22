// this enum contains the keywords exported out of RTK and RTK Query
// wherever codegen generates RTK Query/RTK code, the keywords are picked from here

export const reduxIdentifiers = {
  fetchBaseQuery: "fetchBaseQuery",
  createApi: "createApi",
  createEntityAdapter: "createEntityAdapter",
  entityAdapterVarName: "entityAdapter",
  getInitialState: "getInitialState",
  initalStateVarName: "initialState",
  state: "state",
  createApiResultEndpointsProperty: "endpoints",

  getSelectors: "getSelectors",

  // these are keywords used to create selectors. Not RTK/RTK Query specific.
  // typically, users would create their own variable names
  // but these are common variables used across the codegen
  pickDataFromApiSlice: "selectEntryResult",
  entrySelectorsForApiSliceData: "entrySelectors",

  //selectEntryResult
  //getSelectors
  // entrySelectors
};
