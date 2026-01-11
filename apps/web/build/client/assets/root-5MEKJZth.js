import{R as s,a as O,h as $,w as B,i as N,c as Y,r as V,M as f,q as h,O as J,S as W,s as v,j as z}from"./chunk-EPOLDU6W-mFdHVWdG.js";import{j as e}from"./jsx-runtime-u17CrQMm.js";import{T as G}from"./ThemeProvider-BL592D5i.js";import{C as m}from"./index-PQKCHCpG.js";import"./chunk-VMBS36YX-BN69M0IF.js";import"./chunk-OT5FTIRN-R_BgZKso.js";import"./index-B__C1DGo.js";import"./index-7ERyFhN8.js";import"./runtimeEnvironment-BB2sO-19-DQnzQjGy.js";import"./chunk-6WD75OPE-Bksgt9Bb.js";import"./index-Co5n-02Y.js";var i=r=>`🔒 Clerk: ${r.trim()}

For more info, check out the docs: https://clerk.com/docs,
or come say hi in our discord server: https://clerk.com/discord
`,_=`Use 'rootAuthLoader' as your root loader. Then, add <ClerkProvider> to your app.
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
`,H=i(`
You're trying to pass an invalid object in "<ClerkProvider clerkState={...}>".

${_}
`),y=i(`
Looks like you didn't pass 'clerkState' to "<ClerkProvider clerkState={...}>".

${_}
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
Check if signInUrl is missing from your configuration or if it is not an absolute URL.`);var q=i(`
You're trying to use Clerk in React Router SPA Mode without providing a Publishable Key.
Please provide the publishableKey prop on the <ClerkProvider> component.

Example:

<ClerkProvider publishableKey={PUBLISHABLE_KEY}>
`),Q=`To use the new middleware system, you need to:

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

${Q}
`);function X(r){(!r||!r.__internal_clerk_state)&&console.warn(y)}function Z(r){if(!r)throw new Error(y);if(r&&!r.__internal_clerk_state)throw new Error(H)}function ee(r){if(!r||typeof r!="string")throw new Error(q)}var k=()=>{var r;if(typeof window<"u"&&typeof((r=window.__reactRouterContext)==null?void 0:r.isSpaMode)<"u")return window.__reactRouterContext.isSpaMode},w=s.createContext(void 0);w.displayName="ClerkReactRouterOptionsCtx";var re=r=>{const{children:t,options:o}=r;return s.createElement(w.Provider,{value:{value:o}},t)},te=()=>{const r=O(),t=$(),o=s.useRef([]),n=()=>{o.current.forEach(a=>a()),o.current.splice(0,o.current.length)};return s.useEffect(()=>{n()},[t]),(a,d)=>new Promise(u=>{o.current.push(u),r(a,d)})},oe={name:"@clerk/react-router",version:"2.3.9"},c={current:void 0};function ae({children:r,...t}){const o=te(),n=k();s.useEffect(()=>{c.current=o},[o]);const{clerkState:a,...d}=t;m.displayName="ReactClerkProvider",typeof n<"u"&&!n&&Z(a);const{__clerk_ssr_state:u,__publishableKey:x,__proxyUrl:b,__domain:R,__isSatellite:S,__clerk_debug:E,__signInUrl:U,__signUpUrl:C,__afterSignInUrl:j,__afterSignUpUrl:I,__signInForceRedirectUrl:P,__signUpForceRedirectUrl:A,__signInFallbackRedirectUrl:L,__signUpFallbackRedirectUrl:M,__clerkJSUrl:F,__clerkJSVersion:K,__telemetryDisabled:D,__telemetryDebug:T}=a?.__internal_clerk_state||{};s.useEffect(()=>{typeof n<"u"&&!n&&X(a)},[]),s.useEffect(()=>{window.__clerk_debug=E},[]);const g={publishableKey:x,proxyUrl:b,domain:R,isSatellite:S,signInUrl:U,signUpUrl:C,afterSignInUrl:j,afterSignUpUrl:I,signInForceRedirectUrl:P,signUpForceRedirectUrl:A,signInFallbackRedirectUrl:L,signUpFallbackRedirectUrl:M,clerkJSUrl:F,clerkJSVersion:K,telemetry:{disabled:D,debug:T}};return s.createElement(re,{options:g},s.createElement(m,{routerPush:p=>{var l;return(l=c.current)==null?void 0:l.call(c,p)},routerReplace:p=>{var l;return(l=c.current)==null?void 0:l.call(c,p,{replace:!0})},initialState:u,sdkMetadata:oe,...g,...d},r))}var ne=({children:r,loaderData:t,...o})=>{let n;const a=k();return!a&&t?.clerkState&&(n=t.clerkState),typeof a<"u"&&a&&ee(o.publishableKey),s.createElement(ae,{...o,clerkState:n},r)};const se="/assets/index-CmKVAaUy.css",_e=()=>[{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"},{rel:"stylesheet",href:se},{rel:"manifest",href:"/manifest.json"},{rel:"icon",href:"/favicon.ico",type:"image/x-icon"}],ye=()=>[{title:"Studio Platform"},{name:"viewport",content:"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"},{name:"theme-color",content:"#18181B"},{name:"mobile-web-app-capable",content:"yes"},{name:"apple-mobile-web-app-status-bar-style",content:"black-translucent"}],ke=B(function(){const t=Y();return V.useEffect(()=>{"serviceWorker"in navigator&&navigator.serviceWorker.getRegistrations().then(o=>{for(const n of o)n.unregister(),console.log("SW unregistered")})},[]),e.jsx(ne,{loaderData:t,signUpFallbackRedirectUrl:"/",signInFallbackRedirectUrl:"/dashboard",children:e.jsx(G,{defaultTheme:"system",storageKey:"studio-theme",children:e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx(f,{}),e.jsx(h,{}),t?.env?.VITE_GA_ID&&e.jsxs(e.Fragment,{children:[e.jsx("script",{async:!0,src:`https://www.googletagmanager.com/gtag/js?id=${t.env.VITE_GA_ID}`}),e.jsx("script",{dangerouslySetInnerHTML:{__html:`
                                    window.dataLayer = window.dataLayer || [];
                                    function gtag(){dataLayer.push(arguments);}
                                    gtag('js', new Date());
                                    gtag('config', '${t.env.VITE_GA_ID}');
                                `}})]}),e.jsx("script",{dangerouslySetInnerHTML:{__html:`
                            if ('serviceWorker' in navigator && !sessionStorage.getItem('sw_killed_v3')) {
                                navigator.serviceWorker.getRegistrations().then(registrations => {
                                    if (registrations.length > 0) {
                                        for (let r of registrations) r.unregister();
                                        sessionStorage.setItem('sw_killed_v3', 'true');
                                        window.location.reload();
                                    }
                                });
                            }
                        `}})]}),e.jsxs("body",{className:"min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-blue-100 dark:selection:bg-blue-900",children:[e.jsx(J,{}),e.jsx(W,{}),e.jsx(v,{})]})]})})})}),we=N(function(){const t=z();return console.error(t),e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("title",{children:"Oh no!"}),e.jsx(f,{}),e.jsx(h,{})]}),e.jsxs("body",{style:{padding:"20px",fontFamily:"system-ui"},children:[e.jsx("h1",{children:"App Error"}),e.jsx("pre",{children:t instanceof Error?t.message:JSON.stringify(t)}),e.jsx(v,{})]})]})});export{we as ErrorBoundary,ke as default,_e as links,ye as meta};
