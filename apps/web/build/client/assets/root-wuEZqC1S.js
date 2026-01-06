import{R as n,a as T,j as B,w as N,m as Y,d as $,r as J,M as g,n as h,O as W,S as z,o as v,p as H}from"./chunk-JMJ3UQ3L-Dzyq37y6.js";import{j as r}from"./jsx-runtime-u17CrQMm.js";import{T as V}from"./ThemeProvider-8YW7RrVS.js";import{C as f}from"./index-MN1DNKEu.js";import"./chunk-VMBS36YX-Drwahdsv.js";import"./chunk-OT5FTIRN-VRdL-y8m.js";import"./index-B3WcaCfs.js";import"./index-D9_Tf6xB.js";import"./runtimeEnvironment-BB2sO-19-DQnzQjGy.js";import"./chunk-6WD75OPE-B400x_D6.js";import"./index-BcCtgopx.js";var i=e=>`🔒 Clerk: ${e.trim()}

For more info, check out the docs: https://clerk.com/docs,
or come say hi in our discord server: https://clerk.com/discord
`,k=`Use 'rootAuthLoader' as your root loader. Then, add <ClerkProvider> to your app.
Example:

import { rootAuthLoader } from '@clerk/react-router/ssr.server'
import { ClerkProvider } from '@clerk/react-router'

export async function loader(args: Route.LoaderArgs) {
  return rootAuthLoader(args)
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ClerkProvider loaderData={loaderData}>
      <Outlet />
    </ClerkProvider>
  )
}
`,q=i(`
You're trying to pass an invalid object in "<ClerkProvider clerkState={...}>".

${k}
`),_=i(`
Looks like you didn't pass 'clerkState' to "<ClerkProvider clerkState={...}>".

${k}
`);i(`
You're calling 'getAuth()' from a loader, without providing the loader args object.
Example:

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args)

  // Your code here
}
`);i(`
You're returning an invalid response from the 'rootAuthLoader' inside root.tsx.
You can only return plain objects, Responses created using the React Router 'data()'helper or
custom redirect 'Response' instances (status codes in the range of 300 to 400).
If you want to return a primitive value or an array, you can always wrap the response with an object.

Example:

export async function loader(args: Route.LoaderArgs) {
  return rootAuthLoader(args, async ({ auth }) => {
    const { userId } = auth;
    const posts = await database.getPostsByUserId(userId);

    return { data: posts }
    // Or
    return data(posts, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  })
}
`);i(`
A secretKey must be provided in order to use SSR and the exports from @clerk/react-router/api.');
If your runtime supports environment variables, you can add a CLERK_SECRET_KEY variable to your config.
Otherwise, you can pass a secretKey parameter to rootAuthLoader or getAuth.
`);i("Missing domain and proxyUrl. A satellite application needs to specify a domain or a proxyUrl");i(`
Invalid signInUrl. A satellite application requires a signInUrl for development instances.
Check if signInUrl is missing from your configuration or if it is not an absolute URL.`);var Q=i(`
You're trying to use Clerk in React Router SPA Mode without providing a Publishable Key.
Please provide the publishableKey prop on the <ClerkProvider> component.

Example:

<ClerkProvider publishableKey={PUBLISHABLE_KEY}>
`),G=`To use the new middleware system, you need to:

1. Enable the 'v8_middleware' future flag in your config:

// react-router.config.ts
export default {
  future: {
    v8_middleware: true,
  },
} satisfies Config;

2. Install the clerkMiddleware:

import { clerkMiddleware, rootAuthLoader } from '@clerk/react-router/server'
import { ClerkProvider } from '@clerk/react-router'

export const middleware: Route.MiddlewareFunction[] = [clerkMiddleware()]

export const loader = (args: Route.LoaderArgs) => rootAuthLoader(args)

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ClerkProvider loaderData={loaderData}>
      <Outlet />
    </ClerkProvider>
  )
}
`;i(`
'"clerkMiddleware()" not detected.

${G}
`);function X(e){(!e||!e.__internal_clerk_state)&&console.warn(_)}function Z(e){if(!e)throw new Error(_);if(e&&!e.__internal_clerk_state)throw new Error(q)}function ee(e){if(!e||typeof e!="string")throw new Error(Q)}var y=()=>{var e;if(typeof window<"u"&&typeof((e=window.__reactRouterContext)==null?void 0:e.isSpaMode)<"u")return window.__reactRouterContext.isSpaMode},b=n.createContext(void 0);b.displayName="ClerkReactRouterOptionsCtx";var re=e=>{const{children:t,options:o}=e;return n.createElement(b.Provider,{value:{value:o}},t)},te=()=>{const e=T(),t=B(),o=n.useRef([]),s=()=>{o.current.forEach(a=>a()),o.current.splice(0,o.current.length)};return n.useEffect(()=>{s()},[t]),(a,d)=>new Promise(u=>{o.current.push(u),e(a,d)})},oe={name:"@clerk/react-router",version:"2.3.7"},c={current:void 0};function ae({children:e,...t}){const o=te(),s=y();n.useEffect(()=>{c.current=o},[o]);const{clerkState:a,...d}=t;f.displayName="ReactClerkProvider",typeof s<"u"&&!s&&Z(a);const{__clerk_ssr_state:u,__publishableKey:x,__proxyUrl:w,__domain:R,__isSatellite:S,__clerk_debug:U,__signInUrl:E,__signUpUrl:C,__afterSignInUrl:P,__afterSignUpUrl:j,__signInForceRedirectUrl:A,__signUpForceRedirectUrl:I,__signInFallbackRedirectUrl:M,__signUpFallbackRedirectUrl:L,__clerkJSUrl:F,__clerkJSVersion:K,__telemetryDisabled:D,__telemetryDebug:O}=a?.__internal_clerk_state||{};n.useEffect(()=>{typeof s<"u"&&!s&&X(a)},[]),n.useEffect(()=>{window.__clerk_debug=U},[]);const m={publishableKey:x,proxyUrl:w,domain:R,isSatellite:S,signInUrl:E,signUpUrl:C,afterSignInUrl:P,afterSignUpUrl:j,signInForceRedirectUrl:A,signUpForceRedirectUrl:I,signInFallbackRedirectUrl:M,signUpFallbackRedirectUrl:L,clerkJSUrl:F,clerkJSVersion:K,telemetry:{disabled:D,debug:O}};return n.createElement(re,{options:m},n.createElement(f,{routerPush:p=>{var l;return(l=c.current)==null?void 0:l.call(c,p)},routerReplace:p=>{var l;return(l=c.current)==null?void 0:l.call(c,p,{replace:!0})},initialState:u,sdkMetadata:oe,...m,...d},e))}var se=({children:e,loaderData:t,...o})=>{let s;const a=y();return!a&&t?.clerkState&&(s=t.clerkState),typeof a<"u"&&a&&ee(o.publishableKey),n.createElement(ae,{...o,clerkState:s},e)};const ne="/assets/index-DHQhAKxe.css",ke=()=>[{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"},{rel:"stylesheet",href:ne},{rel:"manifest",href:"/manifest.json"},{rel:"icon",href:"/favicon.ico",type:"image/x-icon"}],_e=()=>[{title:"Studio Platform"},{name:"viewport",content:"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"},{name:"theme-color",content:"#18181B"},{name:"mobile-web-app-capable",content:"yes"},{name:"apple-mobile-web-app-status-bar-style",content:"black-translucent"}],ye=N(function(){const t=$();return J.useEffect(()=>{"serviceWorker"in navigator&&navigator.serviceWorker.getRegistrations().then(o=>{for(const s of o)s.unregister(),console.log("SW unregistered")})},[]),r.jsx(se,{loaderData:t,signUpFallbackRedirectUrl:"/",signInFallbackRedirectUrl:"/dashboard",children:r.jsx(V,{defaultTheme:"system",storageKey:"studio-theme",children:r.jsxs("html",{lang:"en",children:[r.jsxs("head",{children:[r.jsx("meta",{charSet:"utf-8"}),r.jsx(g,{}),r.jsx(h,{}),r.jsx("script",{dangerouslySetInnerHTML:{__html:`
                            if ('serviceWorker' in navigator && !sessionStorage.getItem('sw_killed_v3')) {
                                navigator.serviceWorker.getRegistrations().then(registrations => {
                                    if (registrations.length > 0) {
                                        for (let r of registrations) r.unregister();
                                        sessionStorage.setItem('sw_killed_v3', 'true');
                                        window.location.reload();
                                    }
                                });
                            }
                        `}})]}),r.jsxs("body",{className:"min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-blue-100 dark:selection:bg-blue-900",children:[r.jsx(W,{}),r.jsx(z,{}),r.jsx(v,{})]})]})})})}),be=Y(function(){const t=H();return console.error(t),r.jsxs("html",{lang:"en",children:[r.jsxs("head",{children:[r.jsx("title",{children:"Oh no!"}),r.jsx(g,{}),r.jsx(h,{})]}),r.jsxs("body",{style:{padding:"20px",fontFamily:"system-ui"},children:[r.jsx("h1",{children:"App Error"}),r.jsx("pre",{children:t instanceof Error?t.message:JSON.stringify(t)}),r.jsx(v,{})]})]})});export{be as ErrorBoundary,ye as default,ke as links,_e as meta};
