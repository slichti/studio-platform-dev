import { jsx, jsxs } from "react/jsx-runtime";
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, Link, useActionData, useNavigation, Form, NavLink, redirect } from "@remix-run/react";
import * as isbotModule from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { rootAuthLoader, getAuth } from "@clerk/remix/ssr.server";
import { ClerkApp, useAuth, useUser, UserButton, SignIn, SignUp } from "@clerk/remix";
import { json } from "@remix-run/cloudflare";
import { useState } from "react";
async function handleRequest(request, responseStatusCode, responseHeaders, remixContext, loadContext) {
  const body = await renderToReadableStream(
    /* @__PURE__ */ jsx(RemixServer, { context: remixContext, url: request.url }),
    {
      // If you wish to abort the rendering process, you can pass a signal here.
      // Please refer to the templates for example son how to configure this.
      // signal: controller.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      }
    }
  );
  if (isBotRequest(request.headers.get("user-agent"))) {
    await body.allReady;
  }
  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode
  });
}
function isBotRequest(userAgent) {
  if (!userAgent) {
    return false;
  }
  if ("isbot" in isbotModule && typeof isbotModule.isbot === "function") {
    return isbotModule.isbot(userAgent);
  }
  if ("default" in isbotModule && typeof isbotModule.default === "function") {
    return isbotModule.default(userAgent);
  }
  return false;
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" }
];
const loader$4 = (args) => rootAuthLoader(args);
function App() {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const root = ClerkApp(App);
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root,
  links,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const API_URL = "http://localhost:8787";
async function apiRequest(path, token, options = {}) {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || res.statusText);
  }
  return res.json();
}
const loader$3 = async (args) => {
  const { params } = args;
  const { getToken } = await getAuth(args);
  const token = await getToken();
  const bookings = await apiRequest(`/classes/${params.id}/bookings`, token);
  return json({ bookings, classId: params.id });
};
function ClassRoster() {
  const { bookings, classId } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: "20px" }, children: [
      /* @__PURE__ */ jsx(Link, { to: "/dashboard/classes", style: { color: "#71717a", textDecoration: "none", fontSize: "0.875rem" }, children: "← Back to Classes" }),
      /* @__PURE__ */ jsx("h2", { style: { fontSize: "1.875rem", fontWeight: "bold", marginTop: "10px" }, children: "Class Roster" })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { background: "white", borderRadius: "8px", border: "1px solid #e4e4e7", overflow: "hidden" }, children: /* @__PURE__ */ jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
      /* @__PURE__ */ jsx("thead", { style: { background: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }, children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { style: { textAlign: "left", padding: "12px 20px", fontSize: "0.875rem", color: "#52525b" }, children: "Student" }),
        /* @__PURE__ */ jsx("th", { style: { textAlign: "left", padding: "12px 20px", fontSize: "0.875rem", color: "#52525b" }, children: "Email" }),
        /* @__PURE__ */ jsx("th", { style: { textAlign: "left", padding: "12px 20px", fontSize: "0.875rem", color: "#52525b" }, children: "Status" }),
        /* @__PURE__ */ jsx("th", { style: { textAlign: "left", padding: "12px 20px", fontSize: "0.875rem", color: "#52525b" }, children: "Booked At" })
      ] }) }),
      /* @__PURE__ */ jsxs("tbody", { children: [
        bookings.map((booking) => {
          var _a;
          return /* @__PURE__ */ jsxs("tr", { style: { borderBottom: "1px solid #e4e4e7" }, children: [
            /* @__PURE__ */ jsx("td", { style: { padding: "12px 20px" }, children: /* @__PURE__ */ jsx("span", { style: { fontWeight: "500" }, children: ((_a = booking.user.profile) == null ? void 0 : _a.fullName) || "Unknown" }) }),
            /* @__PURE__ */ jsx("td", { style: { padding: "12px 20px", color: "#52525b" }, children: booking.user.email }),
            /* @__PURE__ */ jsx("td", { style: { padding: "12px 20px" }, children: /* @__PURE__ */ jsx("span", { style: {
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: "bold",
              background: booking.status === "confirmed" ? "#dcfce7" : "#f4f4f5",
              color: booking.status === "confirmed" ? "#166534" : "#52525b"
            }, children: booking.status }) }),
            /* @__PURE__ */ jsx("td", { style: { padding: "12px 20px", color: "#71717a", fontSize: "0.875rem" }, children: new Date(booking.createdAt).toLocaleDateString() })
          ] }, booking.id);
        }),
        bookings.length === 0 && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 4, style: { padding: "40px", textAlign: "center", color: "#71717a" }, children: "No bookings yet." }) })
      ] })
    ] }) })
  ] });
}
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: ClassRoster,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const MOCK_VIDEO_ID = "";
const loader$2 = async (args) => {
  const { params } = args;
  const { getToken } = await getAuth(args);
  return json({
    classId: params.id,
    videoId: MOCK_VIDEO_ID,
    title: "Yoga Flow - Recording"
  });
};
function WatchRecording() {
  const { classId, videoId, title } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "20px" }, children: /* @__PURE__ */ jsx(Link, { to: "/dashboard/classes", style: { color: "#71717a", textDecoration: "none", fontSize: "0.875rem" }, children: "← Back to Classes" }) }),
    /* @__PURE__ */ jsxs("div", { style: { maxWidth: "800px", margin: "0 auto" }, children: [
      /* @__PURE__ */ jsx("h1", { style: { fontSize: "1.5rem", fontWeight: "bold", marginBottom: "20px" }, children: title }),
      videoId ? /* @__PURE__ */ jsx("div", { style: {
        position: "relative",
        paddingTop: "56.25%"
        /* 16:9 Aspect Ratio */
      }, children: /* @__PURE__ */ jsx(
        "iframe",
        {
          src: `https://customer-<YOUR_CODE>.cloudflarestream.com/${videoId}/iframe`,
          style: { border: "none", position: "absolute", top: 0, left: 0, height: "100%", width: "100%" },
          allow: "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;",
          allowFullScreen: true
        }
      ) }) : /* @__PURE__ */ jsxs("div", { style: { padding: "60px", background: "#f4f4f5", borderRadius: "8px", textAlign: "center", color: "#71717a" }, children: [
        /* @__PURE__ */ jsx("p", { children: "Recording is processing or not available." }),
        /* @__PURE__ */ jsx("p", { style: { fontSize: "0.875rem", marginTop: "10px" }, children: "Simulated Video Player" })
      ] })
    ] })
  ] });
}
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: WatchRecording,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
function ImageUploader({ onUploadComplete }) {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const handleFileChange = async (e) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = await getToken();
      const { uploadURL } = await apiRequest("/uploads/image", token, {
        method: "POST"
      });
      const formData = new FormData();
      formData.append("file", file);
      const cfResponse = await fetch(uploadURL, {
        method: "POST",
        body: formData
      });
      if (!cfResponse.ok) {
        throw new Error("Failed to upload image to Cloudflare");
      }
      const cfData = await cfResponse.json();
      const imageId = cfData.result.id;
      onUploadComplete(imageId);
      setPreview(URL.createObjectURL(file));
    } catch (e2) {
      console.error(e2);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { style: { marginTop: "10px" }, children: [
    /* @__PURE__ */ jsx("label", { style: { display: "block", fontSize: "0.875rem", marginBottom: "5px" }, children: "Thumbnail" }),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "file",
        accept: "image/*",
        onChange: handleFileChange,
        disabled: uploading,
        style: { fontSize: "0.875rem" }
      }
    ),
    uploading && /* @__PURE__ */ jsx("span", { style: { fontSize: "0.875rem", color: "#71717a", marginLeft: "10px" }, children: "Uploading..." }),
    preview && /* @__PURE__ */ jsx("div", { style: { marginTop: "10px" }, children: /* @__PURE__ */ jsx("img", { src: preview, alt: "Preview", style: { width: "100px", height: "100px", objectFit: "cover", borderRadius: "6px" } }) })
  ] });
}
const loader$1 = async (args) => {
  const { getToken } = await getAuth(args);
  const token = await getToken();
  const classes = await apiRequest("/classes", token);
  return json({ classes });
};
const action = async (args) => {
  const { request } = args;
  const { getToken } = await getAuth(args);
  const token = await getToken();
  const formData = await request.formData();
  const title = formData.get("title");
  const startTime = formData.get("startTime");
  const duration = formData.get("duration");
  const createZoom = formData.get("createZoom") === "on";
  const thumbnailId = formData.get("thumbnailId");
  try {
    await apiRequest("/classes", token, {
      method: "POST",
      body: JSON.stringify({
        title,
        description: "Class created via Dashboard",
        startTime,
        durationMinutes: Number(duration),
        capacity: 20,
        // Default
        createZoomMeeting: createZoom,
        thumbnailUrl: thumbnailId ? `https://imagedelivery.net/<ACCOUNT_HASH>/${thumbnailId}/public` : void 0
        // Need Hash
      })
    });
    return json({ success: true });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
};
function ClassesRoute() {
  const { classes } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [thumbnailId, setThumbnailId] = useState(null);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }, children: /* @__PURE__ */ jsx("h2", { style: { fontSize: "1.875rem", fontWeight: "bold" }, children: "Classes" }) }),
    /* @__PURE__ */ jsxs("div", { style: { background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e4e4e7", marginBottom: "40px" }, children: [
      /* @__PURE__ */ jsx("h3", { style: { fontSize: "1.1rem", fontWeight: "semibold", marginBottom: "15px" }, children: "Create New Class" }),
      /* @__PURE__ */ jsxs(Form, { method: "post", style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "20px", alignItems: "end" }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: { display: "block", fontSize: "0.875rem", marginBottom: "5px" }, children: "Title" }),
          /* @__PURE__ */ jsx("input", { name: "title", required: true, type: "text", style: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d4d4d8" } })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: { display: "block", fontSize: "0.875rem", marginBottom: "5px" }, children: "Start Time" }),
          /* @__PURE__ */ jsx("input", { name: "startTime", required: true, type: "datetime-local", style: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d4d4d8" } })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: { display: "block", fontSize: "0.875rem", marginBottom: "5px" }, children: "Duration (min)" }),
          /* @__PURE__ */ jsx("input", { name: "duration", required: true, type: "number", defaultValue: "60", style: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d4d4d8" } })
        ] }),
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "thumbnailId", value: thumbnailId || "" }),
        /* @__PURE__ */ jsx("div", { style: { marginBottom: "10px" }, children: /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem" }, children: [
          /* @__PURE__ */ jsx("input", { name: "createZoom", type: "checkbox" }),
          "Auto-create Zoom?"
        ] }) }),
        /* @__PURE__ */ jsx("button", { disabled: isSubmitting, type: "submit", style: { padding: "10px 20px", background: "#18181b", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }, children: isSubmitting ? "Creating..." : "Create Class" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { marginTop: "10px" }, children: /* @__PURE__ */ jsx(ImageUploader, { onUploadComplete: (id) => setThumbnailId(id) }) }),
      (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("p", { style: { color: "red", marginTop: "10px" }, children: actionData.error })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: "15px" }, children: [
      classes.map((cls) => /* @__PURE__ */ jsxs("div", { style: { background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e4e4e7", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h4", { style: { fontWeight: "bold" }, children: cls.title }),
          /* @__PURE__ */ jsx("p", { style: { color: "#71717a", fontSize: "0.875rem" }, children: new Date(cls.startTime).toLocaleString() })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "10px", alignItems: "center" }, children: [
          cls.zoomMeetingUrl && /* @__PURE__ */ jsx("a", { href: cls.zoomMeetingUrl, target: "_blank", rel: "noreferrer", style: { fontSize: "0.875rem", color: "#2563eb" }, children: "Zoom Link" }),
          /* @__PURE__ */ jsx("a", { href: `/dashboard/classes/${cls.id}/roster`, style: { fontSize: "0.875rem", textDecoration: "underline" }, children: "View Roster" })
        ] })
      ] }, cls.id)),
      classes.length === 0 && /* @__PURE__ */ jsx("p", { style: { color: "#71717a" }, children: "No classes found." })
    ] })
  ] });
}
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: ClassesRoute,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
function DashboardIndex() {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h2", { style: { fontSize: "1.875rem", fontWeight: "bold", marginBottom: "20px" }, children: "Welcome back!" }),
    /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }, children: /* @__PURE__ */ jsxs("div", { style: { padding: "20px", background: "white", borderRadius: "8px", border: "1px solid #e4e4e7" }, children: [
      /* @__PURE__ */ jsx("h3", { style: { fontSize: "1rem", fontWeight: "semibold", marginBottom: "10px" }, children: "Quick Stats" }),
      /* @__PURE__ */ jsx("p", { style: { color: "#71717a" }, children: "No classes scheduled yet." })
    ] }) })
  ] });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: DashboardIndex
}, Symbol.toStringTag, { value: "Module" }));
function Layout({ children }) {
  const { user, isLoaded } = useUser();
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", height: "100vh", fontFamily: "'Inter', sans-serif" }, children: [
    /* @__PURE__ */ jsxs("aside", { style: { width: "250px", background: "#f4f4f5", padding: "20px", borderRight: "1px solid #e4e4e7" }, children: [
      /* @__PURE__ */ jsx("div", { style: { marginBottom: "40px" }, children: /* @__PURE__ */ jsx("h1", { style: { fontSize: "1.25rem", fontWeight: "bold" }, children: "Studio Platform" }) }),
      /* @__PURE__ */ jsxs("nav", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: [
        /* @__PURE__ */ jsx(NavLink, { to: "/dashboard", style: ({ isActive }) => ({ padding: "10px", borderRadius: "6px", background: isActive ? "#e4e4e7" : "transparent", textDecoration: "none", color: "#18181b" }), children: "Overview" }),
        /* @__PURE__ */ jsx(NavLink, { to: "/dashboard/classes", style: ({ isActive }) => ({ padding: "10px", borderRadius: "6px", background: isActive ? "#e4e4e7" : "transparent", textDecoration: "none", color: "#18181b" }), children: "Classes" })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { marginTop: "auto" }, children: [
        /* @__PURE__ */ jsx(UserButton, {}),
        isLoaded && user && /* @__PURE__ */ jsx("div", { style: { fontSize: "0.875rem", marginTop: "10px", color: "#71717a" }, children: user.fullName })
      ] })
    ] }),
    /* @__PURE__ */ jsx("main", { style: { flex: 1, padding: "40px", overflowY: "auto" }, children })
  ] });
}
const loader = async (args) => {
  const { userId } = await getAuth(args);
  if (!userId) {
    return redirect("/sign-in");
  }
  return null;
};
function DashboardRoute() {
  return /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: DashboardRoute,
  loader
}, Symbol.toStringTag, { value: "Module" }));
function SignInPage() {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }, children: /* @__PURE__ */ jsx(SignIn, {}) });
}
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: SignInPage
}, Symbol.toStringTag, { value: "Module" }));
function SignUpPage() {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }, children: /* @__PURE__ */ jsx(SignUp, {}) });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: SignUpPage
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => {
  return [
    { title: "Yoga Platform" },
    { name: "description", content: "Welcome to the Yoga Platform" }
  ];
};
function Index() {
  return /* @__PURE__ */ jsxs("div", { style: { fontFamily: "Inter, sans-serif", lineHeight: "1.4" }, children: [
    /* @__PURE__ */ jsx("h1", { children: "Welcome to Yoga Platform" }),
    /* @__PURE__ */ jsx("p", { children: "Multi-tenant Studio Management" })
  ] });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Index,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-i0UxmGHa.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/components-CrqNjzMe.js", "/assets/browser-C3UHr21k.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-m_iEBZRC.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/components-CrqNjzMe.js", "/assets/browser-C3UHr21k.js", "/assets/index-BE8IIHCl.js"], "css": [] }, "routes/dashboard.classes.$id.roster": { "id": "routes/dashboard.classes.$id.roster", "parentId": "routes/dashboard.classes", "path": ":id/roster", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.classes._id.roster-Da0wmmY8.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/components-CrqNjzMe.js"], "css": [] }, "routes/dashboard.classes.$id.watch": { "id": "routes/dashboard.classes.$id.watch", "parentId": "routes/dashboard.classes", "path": ":id/watch", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.classes._id.watch-B88onev0.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/components-CrqNjzMe.js"], "css": [] }, "routes/dashboard.classes": { "id": "routes/dashboard.classes", "parentId": "routes/dashboard", "path": "classes", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.classes-f7GLoRoY.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/index-BE8IIHCl.js", "/assets/components-CrqNjzMe.js", "/assets/browser-C3UHr21k.js"], "css": [] }, "routes/dashboard._index": { "id": "routes/dashboard._index", "parentId": "routes/dashboard", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard._index-6o9MHmjb.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js"], "css": [] }, "routes/dashboard": { "id": "routes/dashboard", "parentId": "root", "path": "dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard-Ddvz8YoG.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/index-BE8IIHCl.js", "/assets/components-CrqNjzMe.js", "/assets/browser-C3UHr21k.js"], "css": [] }, "routes/sign-in.$": { "id": "routes/sign-in.$", "parentId": "root", "path": "sign-in/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/sign-in._-DL5hwWYu.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/index-BE8IIHCl.js", "/assets/components-CrqNjzMe.js", "/assets/browser-C3UHr21k.js"], "css": [] }, "routes/sign-up.$": { "id": "routes/sign-up.$", "parentId": "root", "path": "sign-up/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/sign-up._-MJpHPQB3.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js", "/assets/index-BE8IIHCl.js", "/assets/components-CrqNjzMe.js", "/assets/browser-C3UHr21k.js"], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/_index-C7u98psk.js", "imports": ["/assets/jsx-runtime-Cs6DZD4Z.js"], "css": [] } }, "url": "/assets/manifest-ee848c94.js", "version": "ee848c94" };
const mode = "production";
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": false, "v3_singleFetch": false, "v3_lazyRouteDiscovery": false, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/dashboard.classes.$id.roster": {
    id: "routes/dashboard.classes.$id.roster",
    parentId: "routes/dashboard.classes",
    path: ":id/roster",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/dashboard.classes.$id.watch": {
    id: "routes/dashboard.classes.$id.watch",
    parentId: "routes/dashboard.classes",
    path: ":id/watch",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/dashboard.classes": {
    id: "routes/dashboard.classes",
    parentId: "routes/dashboard",
    path: "classes",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/dashboard._index": {
    id: "routes/dashboard._index",
    parentId: "routes/dashboard",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/dashboard": {
    id: "routes/dashboard",
    parentId: "root",
    path: "dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/sign-in.$": {
    id: "routes/sign-in.$",
    parentId: "root",
    path: "sign-in/*",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/sign-up.$": {
    id: "routes/sign-up.$",
    parentId: "root",
    path: "sign-up/*",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route8
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
