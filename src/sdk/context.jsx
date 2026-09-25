import React from 'react'

export const KissflowSDKContext = React.createContext({
  kf: null,
  sdkReady: false,
  sdkFailed: false,
  isNonKissflowUser: false,
  identityReady: false,
  identitySource: null,
  switchExternalIdentity: null,
})
