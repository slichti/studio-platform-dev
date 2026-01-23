import{b as O,j as N,w as $,k as B,u as Y,M as f,p as h,O as W,S as V,q as v,l as H}from"./chunk-JMJ3UQ3L-DR3wp0kw.js";import{j as e}from"./vendor-puck-By1A5E5K.js";import{R as n,a as J}from"./vendor-sentry-BD1MTpLq.js";import{T as z}from"./ThemeProvider-ueHA7FHr.js";import{T as G}from"./index-C_1Jy3MY.js";import{C as m}from"./index-Dua1JDqF.js";import"./chunk-VMBS36YX-BqsXR-ha.js";import"./chunk-OT5FTIRN-BigJMP2-.js";import"./index-D9ERMtIL.js";import"./vendor-charts-BzoqY3DK.js";import"./runtimeEnvironment-BB2sO-19-DQnzQjGy.js";import"./chunk-6WD75OPE-C6oZKFq7.js";var i=r=>`🔒 Clerk: ${r.trim()}

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
`,q=i(`
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
Check if signInUrl is missing from your configuration or if it is not an absolute URL.`);var Q=i(`
You're trying to use Clerk in React Router SPA Mode without providing a Publishable Key.
Please provide the publishableKey prop on the <ClerkProvider> component.

Example:

<ClerkProvider publishableKey={PUBLISHABLE_KEY}>
`),X=`To use the new middleware system, you need to:

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

${X}
`);function Z(r){(!r||!r.__internal_clerk_state)&&console.warn(y)}function ee(r){if(!r)throw new Error(y);if(r&&!r.__internal_clerk_state)throw new Error(q)}function re(r){if(!r||typeof r!="string")throw new Error(Q)}var k=()=>{var r;if(typeof window<"u"&&typeof((r=window.__reactRouterContext)==null?void 0:r.isSpaMode)<"u")return window.__reactRouterContext.isSpaMode},w=n.createContext(void 0);w.displayName="ClerkReactRouterOptionsCtx";var te=r=>{const{children:t,options:o}=r;return n.createElement(w.Provider,{value:{value:o}},t)},oe=()=>{const r=O(),t=N(),o=n.useRef([]),s=()=>{o.current.forEach(a=>a()),o.current.splice(0,o.current.length)};return n.useEffect(()=>{s()},[t]),(a,d)=>new Promise(u=>{o.current.push(u),r(a,d)})},ae={name:"@clerk/react-router",version:"2.3.11"},c={current:void 0};function se({children:r,...t}){const o=oe(),s=k();n.useEffect(()=>{c.current=o},[o]);const{clerkState:a,...d}=t;m.displayName="ReactClerkProvider",typeof s<"u"&&!s&&ee(a);const{__clerk_ssr_state:u,__publishableKey:x,__proxyUrl:b,__domain:R,__isSatellite:S,__clerk_debug:E,__signInUrl:U,__signUpUrl:C,__afterSignInUrl:j,__afterSignUpUrl:I,__signInForceRedirectUrl:P,__signUpForceRedirectUrl:A,__signInFallbackRedirectUrl:L,__signUpFallbackRedirectUrl:M,__clerkJSUrl:F,__clerkJSVersion:T,__telemetryDisabled:K,__telemetryDebug:D}=a?.__internal_clerk_state||{};n.useEffect(()=>{typeof s<"u"&&!s&&Z(a)},[]),n.useEffect(()=>{window.__clerk_debug=E},[]);const g={publishableKey:x,proxyUrl:b,domain:R,isSatellite:S,signInUrl:U,signUpUrl:C,afterSignInUrl:j,afterSignUpUrl:I,signInForceRedirectUrl:P,signUpForceRedirectUrl:A,signInFallbackRedirectUrl:L,signUpFallbackRedirectUrl:M,clerkJSUrl:F,clerkJSVersion:T,telemetry:{disabled:K,debug:D}};return n.createElement(te,{options:g},n.createElement(m,{routerPush:p=>{var l;return(l=c.current)==null?void 0:l.call(c,p)},routerReplace:p=>{var l;return(l=c.current)==null?void 0:l.call(c,p,{replace:!0})},initialState:u,sdkMetadata:ae,...g,...d},r))}var ne=({children:r,loaderData:t,...o})=>{let s;const a=k();return!a&&t?.clerkState&&(s=t.clerkState),typeof a<"u"&&a&&re(o.publishableKey),n.createElement(se,{...o,clerkState:s},r)};const ie="/assets/index-NhviLyf1.css",ke=()=>[{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"},{rel:"stylesheet",href:ie},{rel:"manifest",href:"/manifest.json"},{rel:"icon",href:"/favicon.ico",type:"image/x-icon"}],we=()=>[{title:"Studio Platform"},{name:"viewport",content:"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"},{name:"theme-color",content:"#18181B"},{name:"mobile-web-app-capable",content:"yes"},{name:"apple-mobile-web-app-status-bar-style",content:"black-translucent"}],xe=$(function(){const t=Y();return J.useEffect(()=>{"serviceWorker"in navigator&&navigator.serviceWorker.getRegistrations().then(o=>{for(const s of o)s.unregister(),console.log("SW unregistered")})},[]),e.jsx(ne,{loaderData:t,signUpFallbackRedirectUrl:"/",signInFallbackRedirectUrl:"/dashboard",children:e.jsx(z,{defaultTheme:"light",storageKey:"studio-theme",children:e.jsxs("html",{lang:"en",suppressHydrationWarning:!0,children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx(f,{}),e.jsx(h,{}),t?.env?.VITE_GA_ID&&e.jsxs(e.Fragment,{children:[e.jsx("script",{async:!0,src:`https://www.googletagmanager.com/gtag/js?id=${t.env.VITE_GA_ID}`}),e.jsx("script",{dangerouslySetInnerHTML:{__html:`
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
                        `}})]}),e.jsxs("body",{className:"min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-blue-100 dark:selection:bg-blue-900",suppressHydrationWarning:!0,children:[e.jsx(W,{}),e.jsx(G,{position:"top-right",richColors:!0}),e.jsx(V,{}),e.jsx(v,{})]})]})})})}),be=B(function(){const t=H();return console.error(t),e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("title",{children:"Oh no!"}),e.jsx(f,{}),e.jsx(h,{})]}),e.jsxs("body",{style:{padding:"20px",fontFamily:"system-ui"},children:[e.jsx("h1",{children:"App Error"}),e.jsx("pre",{children:t instanceof Error?t.message:JSON.stringify(t)}),e.jsx(v,{})]})]})});export{be as ErrorBoundary,xe as default,ke as links,we as meta};
