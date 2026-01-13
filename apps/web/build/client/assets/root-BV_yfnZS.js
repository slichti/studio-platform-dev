import{p as l,bx as c,q as d,a as g,j as e,bJ as h,bK as t,bL as r,aC as m,bM as p,bN as a,by as u}from"./vendor-react-D59Q0YKK.js";import{T as x}from"./ThemeProvider-CzNjogV3.js";import"./vendor-puck-RN2Ey-av.js";import"./vendor-charts-Dp-zC2wb.js";const f="/assets/index-BgFJDva_.css",v=()=>[{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"},{rel:"stylesheet",href:f},{rel:"manifest",href:"/manifest.json"},{rel:"icon",href:"/favicon.ico",type:"image/x-icon"}],k=()=>[{title:"Studio Platform"},{name:"viewport",content:"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"},{name:"theme-color",content:"#18181B"},{name:"mobile-web-app-capable",content:"yes"},{name:"apple-mobile-web-app-status-bar-style",content:"black-translucent"}],_=l(function(){const s=d();return g.useEffect(()=>{"serviceWorker"in navigator&&navigator.serviceWorker.getRegistrations().then(o=>{for(const i of o)i.unregister(),console.log("SW unregistered")})},[]),e.jsx(h,{loaderData:s,signUpFallbackRedirectUrl:"/",signInFallbackRedirectUrl:"/dashboard",children:e.jsx(x,{defaultTheme:"light",storageKey:"studio-theme",children:e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx(t,{}),e.jsx(r,{}),s?.env?.VITE_GA_ID&&e.jsxs(e.Fragment,{children:[e.jsx("script",{async:!0,src:`https://www.googletagmanager.com/gtag/js?id=${s.env.VITE_GA_ID}`}),e.jsx("script",{dangerouslySetInnerHTML:{__html:`
                                    window.dataLayer = window.dataLayer || [];
                                    function gtag(){dataLayer.push(arguments);}
                                    gtag('js', new Date());
                                    gtag('config', '${s.env.VITE_GA_ID}');
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
                        `}})]}),e.jsxs("body",{className:"min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-blue-100 dark:selection:bg-blue-900",children:[e.jsx(m,{}),e.jsx(p,{}),e.jsx(a,{})]})]})})})}),E=c(function(){const s=u();return console.error(s),e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("title",{children:"Oh no!"}),e.jsx(t,{}),e.jsx(r,{})]}),e.jsxs("body",{style:{padding:"20px",fontFamily:"system-ui"},children:[e.jsx("h1",{children:"App Error"}),e.jsx("pre",{children:s instanceof Error?s.message:JSON.stringify(s)}),e.jsx(a,{})]})]})});export{E as ErrorBoundary,_ as default,v as links,k as meta};
