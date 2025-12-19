import{R as n,p as Y,q as B,w as N,t as $,v as T,o as r,M as g,L as m,O as J,S as V,x as v,y as q}from"./chunk-JMJ3UQ3L-BcnvHMJ6.js";import{C as h}from"./index-Cs1IdFfL.js";import"./index-CMwWdKhW.js";var i=e=>`🔒 Clerk: ${e.trim()}

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
`),k=i(`
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
Check if signInUrl is missing from your configuration or if it is not an absolute URL.`);var z=i(`
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
`);function Q(e){(!e||!e.__internal_clerk_state)&&console.warn(k)}function W(e){if(!e)throw new Error(k);if(e&&!e.__internal_clerk_state)throw new Error(H)}function X(e){if(!e||typeof e!="string")throw new Error(z)}var y=()=>{var e;if(typeof window<"u"&&typeof((e=window.__reactRouterContext)==null?void 0:e.isSpaMode)<"u")return window.__reactRouterContext.isSpaMode},x=n.createContext(void 0);x.displayName="ClerkReactRouterOptionsCtx";var Z=e=>{const{children:t,options:o}=e;return n.createElement(x.Provider,{value:{value:o}},t)},ee=()=>{const e=Y(),t=B(),o=n.useRef([]),s=()=>{o.current.forEach(a=>a()),o.current.splice(0,o.current.length)};return n.useEffect(()=>{s()},[t]),(a,c)=>new Promise(u=>{o.current.push(u),e(a,c)})},re={name:"@clerk/react-router",version:"2.3.6"},d={current:void 0};function te({children:e,...t}){const o=ee(),s=y();n.useEffect(()=>{d.current=o},[o]);const{clerkState:a,...c}=t;h.displayName="ReactClerkProvider",typeof s<"u"&&!s&&W(a);const{__clerk_ssr_state:u,__publishableKey:w,__proxyUrl:R,__domain:b,__isSatellite:S,__clerk_debug:U,__signInUrl:C,__signUpUrl:E,__afterSignInUrl:P,__afterSignUpUrl:A,__signInForceRedirectUrl:j,__signUpForceRedirectUrl:I,__signInFallbackRedirectUrl:L,__signUpFallbackRedirectUrl:M,__clerkJSUrl:F,__clerkJSVersion:K,__telemetryDisabled:O,__telemetryDebug:D}=(a==null?void 0:a.__internal_clerk_state)||{};n.useEffect(()=>{typeof s<"u"&&!s&&Q(a)},[]),n.useEffect(()=>{window.__clerk_debug=U},[]);const f={publishableKey:w,proxyUrl:R,domain:b,isSatellite:S,signInUrl:C,signUpUrl:E,afterSignInUrl:P,afterSignUpUrl:A,signInForceRedirectUrl:j,signUpForceRedirectUrl:I,signInFallbackRedirectUrl:L,signUpFallbackRedirectUrl:M,clerkJSUrl:F,clerkJSVersion:K,telemetry:{disabled:O,debug:D}};return n.createElement(Z,{options:f},n.createElement(h,{routerPush:p=>{var l;return(l=d.current)==null?void 0:l.call(d,p)},routerReplace:p=>{var l;return(l=d.current)==null?void 0:l.call(d,p,{replace:!0})},initialState:u,sdkMetadata:re,...f,...c},e))}var oe=({children:e,loaderData:t,...o})=>{let s;const a=y();return!a&&(t!=null&&t.clerkState)&&(s=t.clerkState),typeof a<"u"&&a&&X(o.publishableKey),n.createElement(te,{...o,clerkState:s},e)};const ie=()=>[{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"}],le=N(function(){const t=T();return r.jsx(oe,{loaderData:t,signUpFallbackRedirectUrl:"/",signInFallbackRedirectUrl:"/dashboard",children:r.jsxs("html",{lang:"en",children:[r.jsxs("head",{children:[r.jsx("meta",{charSet:"utf-8"}),r.jsx("meta",{name:"viewport",content:"width=device-width, initial-scale=1"}),r.jsx(g,{}),r.jsx(m,{})]}),r.jsxs("body",{children:[r.jsx(J,{}),r.jsx(V,{}),r.jsx(v,{})]})]})})}),de=$(function(){const t=q();return console.error(t),r.jsxs("html",{lang:"en",children:[r.jsxs("head",{children:[r.jsx("title",{children:"Oh no!"}),r.jsx(g,{}),r.jsx(m,{})]}),r.jsxs("body",{style:{padding:"20px",fontFamily:"system-ui"},children:[r.jsx("h1",{children:"App Error"}),r.jsx("pre",{children:t instanceof Error?t.message:JSON.stringify(t)}),r.jsx(v,{})]})]})});export{de as ErrorBoundary,le as default,ie as links};
