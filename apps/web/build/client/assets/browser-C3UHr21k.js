import{as as v,at as C,au as p,av as R,Z as h,z as M,aw as y,ax as g,ay as E,az as S,aA as F,aB as b,B as P,C as z,aC as k,n as D}from"./components-CrqNjzMe.js";import{r as o}from"./jsx-runtime-Cs6DZD4Z.js";/**
 * @remix-run/react v2.17.2
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */function B(u){if(!u)return null;let m=Object.entries(u),s={};for(let[a,e]of m)if(e&&e.__type==="RouteErrorResponse")s[a]=new v(e.status,e.statusText,e.data,e.internal===!0);else if(e&&e.__type==="Error"){if(e.__subType){let i=window[e.__subType];if(typeof i=="function")try{let r=new i(e.message);r.stack=e.stack,s[a]=r}catch{}}if(s[a]==null){let i=new Error(e.message);i.stack=e.stack,s[a]=i}}else s[a]=e;return s}/**
 * @remix-run/react v2.17.2
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let n,t,f=!1,c;new Promise(u=>{c=u}).catch(()=>{});function O(u){if(!t){if(window.__remixContext.future.v3_singleFetch){if(!n){let _=window.__remixContext.stream;C(_,"No stream found for single fetch decoding"),window.__remixContext.stream=void 0,n=p(_,window).then(l=>{window.__remixContext.state=l.value,n.value=!0}).catch(l=>{n.error=l})}if(n.error)throw n.error;if(!n.value)throw n}let i=R(window.__remixManifest.routes,window.__remixRouteModules,window.__remixContext.state,window.__remixContext.future,window.__remixContext.isSpaMode),r;if(!window.__remixContext.isSpaMode){r={...window.__remixContext.state,loaderData:{...window.__remixContext.state.loaderData}};let _=h(i,window.location,window.__remixContext.basename);if(_)for(let l of _){let d=l.route.id,x=window.__remixRouteModules[d],w=window.__remixManifest.routes[d];x&&M(w,x,window.__remixContext.isSpaMode)&&(x.HydrateFallback||!w.hasLoader)?r.loaderData[d]=void 0:w&&!w.hasLoader&&(r.loaderData[d]=null)}r&&r.errors&&(r.errors=B(r.errors))}t=y({routes:i,history:S(),basename:window.__remixContext.basename,future:{v7_normalizeFormMethod:!0,v7_fetcherPersist:window.__remixContext.future.v3_fetcherPersist,v7_partialHydration:!0,v7_prependBasename:!0,v7_relativeSplatPath:window.__remixContext.future.v3_relativeSplatPath,v7_skipActionErrorRevalidation:window.__remixContext.future.v3_singleFetch===!0},hydrationData:r,mapRouteProperties:D,dataStrategy:window.__remixContext.future.v3_singleFetch&&!window.__remixContext.isSpaMode?E(window.__remixManifest,window.__remixRouteModules,()=>t):void 0,patchRoutesOnNavigation:g(window.__remixManifest,window.__remixRouteModules,window.__remixContext.future,window.__remixContext.isSpaMode,window.__remixContext.basename)}),t.state.initialized&&(f=!0,t.initialize()),t.createRoutesForHMR=F,window.__remixRouter=t,c&&c(t)}let[m,s]=o.useState(void 0),[a,e]=o.useState(t.state.location);return o.useLayoutEffect(()=>{f||(f=!0,t.initialize())},[]),o.useLayoutEffect(()=>t.subscribe(i=>{i.location!==a&&e(i.location)}),[a]),b(t,window.__remixManifest,window.__remixRouteModules,window.__remixContext.future,window.__remixContext.isSpaMode),o.createElement(o.Fragment,null,o.createElement(P.Provider,{value:{manifest:window.__remixManifest,routeModules:window.__remixRouteModules,future:window.__remixContext.future,criticalCss:m,isSpaMode:window.__remixContext.isSpaMode}},o.createElement(z,{location:a},o.createElement(k,{router:t,fallbackElement:null,future:{v7_startTransition:!0}}))),window.__remixContext.future.v3_singleFetch?o.createElement(o.Fragment,null):null)}export{O as R};
