import { jsx, jsxs } from "react/jsx-runtime";
import { ServerRouter, UNSAFE_withComponentProps, useLoaderData, Meta, Links, Outlet, ScrollRestoration, Scripts, UNSAFE_withErrorBoundaryProps, useRouteError, NavLink, redirect, useActionData, useNavigation, Form, Link } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { ClerkProvider, useUser, UserButton, useAuth, SignIn, SignUp } from "@clerk/react-router";
import { rootAuthLoader, getAuth } from "@clerk/react-router/ssr.server";
import { useState } from "react";
async function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  let body = await renderToReadableStream(
    /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
    {
      signal: request.signal,
      onError(error) {
        console.error("SSR Error:", error);
        responseStatusCode = 500;
      }
    }
  );
  if (isbot(request.headers.get("user-agent") || "")) {
    await body.allReady;
  }
  responseHeaders.set("Content-Type", "text/html");
  return new Response(body.pipeThrough(new TransformStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("<!DOCTYPE html>\n"));
    }
  })), {
    headers: responseHeaders,
    status: responseStatusCode
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [{
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
}];
async function loader$5(args) {
  return rootAuthLoader(args, ({
    request
  }) => {
    return {
      message: "Auth Loaded"
    };
  });
}
const root = UNSAFE_withComponentProps(function App() {
  const loaderData = useLoaderData();
  return /* @__PURE__ */ jsx(ClerkProvider, {
    loaderData,
    signUpFallbackRedirectUrl: "/",
    signInFallbackRedirectUrl: "/dashboard",
    children: /* @__PURE__ */ jsxs("html", {
      lang: "en",
      children: [/* @__PURE__ */ jsxs("head", {
        children: [/* @__PURE__ */ jsx("meta", {
          charSet: "utf-8"
        }), /* @__PURE__ */ jsx("meta", {
          name: "viewport",
          content: "width=device-width, initial-scale=1"
        }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
      }), /* @__PURE__ */ jsxs("body", {
        children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
      })]
    })
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  const error = useRouteError();
  console.error(error);
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("title", {
        children: "Oh no!"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      style: {
        padding: "20px",
        fontFamily: "system-ui"
      },
      children: [/* @__PURE__ */ jsx("h1", {
        children: "App Error"
      }), /* @__PURE__ */ jsx("pre", {
        children: error instanceof Error ? error.message : JSON.stringify(error)
      }), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: root,
  links,
  loader: loader$5
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
const loader$4 = async (args) => {
  const {
    userId
  } = await getAuth(args);
  if (!userId) {
    return redirect("/sign-in");
  }
  return {};
};
const dashboard = UNSAFE_withComponentProps(function DashboardRoute() {
  return /* @__PURE__ */ jsx(Layout, {
    children: /* @__PURE__ */ jsx(Outlet, {})
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard,
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
const loader$3 = async (args) => {
  const {
    getToken
  } = await getAuth(args);
  const token = await getToken();
  const classes = await apiRequest("/classes", token);
  return {
    classes
  };
};
const action = async (args) => {
  const {
    request
  } = args;
  const {
    getToken
  } = await getAuth(args);
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
    return {
      success: true
    };
  } catch (e) {
    return {
      error: e.message
    };
  }
};
const dashboard_classes = UNSAFE_withComponentProps(function ClassesRoute() {
  const {
    classes
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [thumbnailId, setThumbnailId] = useState(null);
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "30px"
      },
      children: /* @__PURE__ */ jsx("h2", {
        style: {
          fontSize: "1.875rem",
          fontWeight: "bold"
        },
        children: "Classes"
      })
    }), /* @__PURE__ */ jsxs("div", {
      style: {
        background: "white",
        padding: "20px",
        borderRadius: "8px",
        border: "1px solid #e4e4e7",
        marginBottom: "40px"
      },
      children: [/* @__PURE__ */ jsx("h3", {
        style: {
          fontSize: "1.1rem",
          fontWeight: "semibold",
          marginBottom: "15px"
        },
        children: "Create New Class"
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: "20px",
          alignItems: "end"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            style: {
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "5px"
            },
            children: "Title"
          }), /* @__PURE__ */ jsx("input", {
            name: "title",
            required: true,
            type: "text",
            style: {
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #d4d4d8"
            }
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            style: {
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "5px"
            },
            children: "Start Time"
          }), /* @__PURE__ */ jsx("input", {
            name: "startTime",
            required: true,
            type: "datetime-local",
            style: {
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #d4d4d8"
            }
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            style: {
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "5px"
            },
            children: "Duration (min)"
          }), /* @__PURE__ */ jsx("input", {
            name: "duration",
            required: true,
            type: "number",
            defaultValue: "60",
            style: {
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #d4d4d8"
            }
          })]
        }), /* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "thumbnailId",
          value: thumbnailId || ""
        }), /* @__PURE__ */ jsx("div", {
          style: {
            marginBottom: "10px"
          },
          children: /* @__PURE__ */ jsxs("label", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.875rem"
            },
            children: [/* @__PURE__ */ jsx("input", {
              name: "createZoom",
              type: "checkbox"
            }), "Auto-create Zoom?"]
          })
        }), /* @__PURE__ */ jsx("button", {
          disabled: isSubmitting,
          type: "submit",
          style: {
            padding: "10px 20px",
            background: "#18181b",
            color: "white",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer"
          },
          children: isSubmitting ? "Creating..." : "Create Class"
        })]
      }), /* @__PURE__ */ jsx("div", {
        style: {
          marginTop: "10px"
        },
        children: /* @__PURE__ */ jsx(ImageUploader, {
          onUploadComplete: (id) => setThumbnailId(id)
        })
      }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("p", {
        style: {
          color: "red",
          marginTop: "10px"
        },
        children: actionData.error
      })]
    }), /* @__PURE__ */ jsxs("div", {
      style: {
        display: "grid",
        gap: "15px"
      },
      children: [classes.map((cls) => /* @__PURE__ */ jsxs("div", {
        style: {
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #e4e4e7",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        },
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("h4", {
            style: {
              fontWeight: "bold"
            },
            children: cls.title
          }), /* @__PURE__ */ jsx("p", {
            style: {
              color: "#71717a",
              fontSize: "0.875rem"
            },
            children: new Date(cls.startTime).toLocaleString()
          })]
        }), /* @__PURE__ */ jsxs("div", {
          style: {
            display: "flex",
            gap: "10px",
            alignItems: "center"
          },
          children: [cls.zoomMeetingUrl && /* @__PURE__ */ jsx("a", {
            href: cls.zoomMeetingUrl,
            target: "_blank",
            rel: "noreferrer",
            style: {
              fontSize: "0.875rem",
              color: "#2563eb"
            },
            children: "Zoom Link"
          }), /* @__PURE__ */ jsx("a", {
            href: `/dashboard/classes/${cls.id}/roster`,
            style: {
              fontSize: "0.875rem",
              textDecoration: "underline"
            },
            children: "View Roster"
          })]
        })]
      }, cls.id)), classes.length === 0 && /* @__PURE__ */ jsx("p", {
        style: {
          color: "#71717a"
        },
        children: "No classes found."
      })]
    })]
  });
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: dashboard_classes,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async (args) => {
  const {
    getToken
  } = await getAuth(args);
  const token = await getToken();
  const bookings = await apiRequest(`/classes/${args.params.id}/bookings`, token);
  return {
    bookings,
    classId: args.params.id
  };
};
const dashboard_classes_$id_roster = UNSAFE_withComponentProps(function ClassRoster() {
  const {
    bookings,
    classId
  } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      style: {
        marginBottom: "20px"
      },
      children: [/* @__PURE__ */ jsx(Link, {
        to: "/dashboard/classes",
        style: {
          color: "#71717a",
          textDecoration: "none",
          fontSize: "0.875rem"
        },
        children: "← Back to Classes"
      }), /* @__PURE__ */ jsx("h2", {
        style: {
          fontSize: "1.875rem",
          fontWeight: "bold",
          marginTop: "10px"
        },
        children: "Class Roster"
      })]
    }), /* @__PURE__ */ jsx("div", {
      style: {
        background: "white",
        borderRadius: "8px",
        border: "1px solid #e4e4e7",
        overflow: "hidden"
      },
      children: /* @__PURE__ */ jsxs("table", {
        style: {
          width: "100%",
          borderCollapse: "collapse"
        },
        children: [/* @__PURE__ */ jsx("thead", {
          style: {
            background: "#f4f4f5",
            borderBottom: "1px solid #e4e4e7"
          },
          children: /* @__PURE__ */ jsxs("tr", {
            children: [/* @__PURE__ */ jsx("th", {
              style: {
                textAlign: "left",
                padding: "12px 20px",
                fontSize: "0.875rem",
                color: "#52525b"
              },
              children: "Student"
            }), /* @__PURE__ */ jsx("th", {
              style: {
                textAlign: "left",
                padding: "12px 20px",
                fontSize: "0.875rem",
                color: "#52525b"
              },
              children: "Email"
            }), /* @__PURE__ */ jsx("th", {
              style: {
                textAlign: "left",
                padding: "12px 20px",
                fontSize: "0.875rem",
                color: "#52525b"
              },
              children: "Status"
            }), /* @__PURE__ */ jsx("th", {
              style: {
                textAlign: "left",
                padding: "12px 20px",
                fontSize: "0.875rem",
                color: "#52525b"
              },
              children: "Booked At"
            })]
          })
        }), /* @__PURE__ */ jsxs("tbody", {
          children: [bookings.map((booking) => {
            var _a;
            return /* @__PURE__ */ jsxs("tr", {
              style: {
                borderBottom: "1px solid #e4e4e7"
              },
              children: [/* @__PURE__ */ jsx("td", {
                style: {
                  padding: "12px 20px"
                },
                children: /* @__PURE__ */ jsx("span", {
                  style: {
                    fontWeight: "500"
                  },
                  children: ((_a = booking.user.profile) == null ? void 0 : _a.fullName) || "Unknown"
                })
              }), /* @__PURE__ */ jsx("td", {
                style: {
                  padding: "12px 20px",
                  color: "#52525b"
                },
                children: booking.user.email
              }), /* @__PURE__ */ jsx("td", {
                style: {
                  padding: "12px 20px"
                },
                children: /* @__PURE__ */ jsx("span", {
                  style: {
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    background: booking.status === "confirmed" ? "#dcfce7" : "#f4f4f5",
                    color: booking.status === "confirmed" ? "#166534" : "#52525b"
                  },
                  children: booking.status
                })
              }), /* @__PURE__ */ jsx("td", {
                style: {
                  padding: "12px 20px",
                  color: "#71717a",
                  fontSize: "0.875rem"
                },
                children: new Date(booking.createdAt).toLocaleDateString()
              })]
            }, booking.id);
          }), bookings.length === 0 && /* @__PURE__ */ jsx("tr", {
            children: /* @__PURE__ */ jsx("td", {
              colSpan: 4,
              style: {
                padding: "40px",
                textAlign: "center",
                color: "#71717a"
              },
              children: "No bookings yet."
            })
          })]
        })]
      })
    })]
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard_classes_$id_roster,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const loader$1 = async (args) => {
  return {
    id: args.params.id,
    title: "Morning Vinyasa Flow",
    cloudflareStreamId: "5d5bc37ffcf54c9b82e996823fca8f4e",
    // Example ID
    recordingStatus: "ready"
  };
};
const dashboard_classes_$id_watch = UNSAFE_withComponentProps(function WatchRecording() {
  const {
    classId,
    videoId,
    title
  } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("div", {
      style: {
        marginBottom: "20px"
      },
      children: /* @__PURE__ */ jsx(Link, {
        to: "/dashboard/classes",
        style: {
          color: "#71717a",
          textDecoration: "none",
          fontSize: "0.875rem"
        },
        children: "← Back to Classes"
      })
    }), /* @__PURE__ */ jsxs("div", {
      style: {
        maxWidth: "800px",
        margin: "0 auto"
      },
      children: [/* @__PURE__ */ jsx("h1", {
        style: {
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "20px"
        },
        children: title
      }), videoId ? /* @__PURE__ */ jsx("div", {
        style: {
          position: "relative",
          paddingTop: "56.25%"
          /* 16:9 Aspect Ratio */
        },
        children: /* @__PURE__ */ jsx("iframe", {
          src: `https://customer-<YOUR_CODE>.cloudflarestream.com/${videoId}/iframe`,
          style: {
            border: "none",
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: "100%"
          },
          allow: "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;",
          allowFullScreen: true
        })
      }) : /* @__PURE__ */ jsxs("div", {
        style: {
          padding: "60px",
          background: "#f4f4f5",
          borderRadius: "8px",
          textAlign: "center",
          color: "#71717a"
        },
        children: [/* @__PURE__ */ jsx("p", {
          children: "Recording is processing or not available."
        }), /* @__PURE__ */ jsx("p", {
          style: {
            fontSize: "0.875rem",
            marginTop: "10px"
          },
          children: "Simulated Video Player"
        })]
      })]
    })]
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard_classes_$id_watch,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const dashboard__index = UNSAFE_withComponentProps(function DashboardIndex() {
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h2", {
      style: {
        fontSize: "1.875rem",
        fontWeight: "bold",
        marginBottom: "20px"
      },
      children: "Welcome back!"
    }), /* @__PURE__ */ jsx("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "20px"
      },
      children: /* @__PURE__ */ jsxs("div", {
        style: {
          padding: "20px",
          background: "white",
          borderRadius: "8px",
          border: "1px solid #e4e4e7"
        },
        children: [/* @__PURE__ */ jsx("h3", {
          style: {
            fontSize: "1rem",
            fontWeight: "semibold",
            marginBottom: "10px"
          },
          children: "Quick Stats"
        }), /* @__PURE__ */ jsx("p", {
          style: {
            color: "#71717a"
          },
          children: "No classes scheduled yet."
        })]
      })
    })]
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard__index
}, Symbol.toStringTag, { value: "Module" }));
const signIn_$ = UNSAFE_withComponentProps(function SignInPage() {
  return /* @__PURE__ */ jsx("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh"
    },
    children: /* @__PURE__ */ jsx(SignIn, {})
  });
});
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: signIn_$
}, Symbol.toStringTag, { value: "Module" }));
const signUp_$ = UNSAFE_withComponentProps(function SignUpPage() {
  return /* @__PURE__ */ jsx("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh"
    },
    children: /* @__PURE__ */ jsx(SignUp, {})
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: signUp_$
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => {
  return [{
    title: "Yoga Platform"
  }, {
    name: "description",
    content: "Welcome to the Yoga Platform"
  }];
};
const _index = UNSAFE_withComponentProps(function Index() {
  return /* @__PURE__ */ jsxs("div", {
    style: {
      fontFamily: "Inter, sans-serif",
      lineHeight: "1.4"
    },
    children: [/* @__PURE__ */ jsx("h1", {
      children: "Welcome to Yoga Platform"
    }), /* @__PURE__ */ jsx("p", {
      children: "Multi-tenant Studio Management"
    })]
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _index,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const loader = async (args) => {
  const {
    getToken
  } = await getAuth(args);
  const token = await getToken();
  try {
    const tenants = await apiRequest("/admin/tenants", token);
    const logs = await apiRequest("/admin/logs", token);
    return {
      tenants,
      logs
    };
  } catch (e) {
    throw new Response("Unauthorized", {
      status: 403
    });
  }
};
const admin = UNSAFE_withComponentProps(function AdminDashboard() {
  const {
    tenants,
    logs,
    error
  } = useLoaderData();
  const [impersonating, setImpersonating] = useState(false);
  if (error) return /* @__PURE__ */ jsxs("div", {
    style: {
      padding: "40px",
      color: "red"
    },
    children: ["Error: ", error]
  });
  return /* @__PURE__ */ jsxs("div", {
    style: {
      padding: "40px",
      fontFamily: "system-ui, sans-serif"
    },
    children: [/* @__PURE__ */ jsx("h1", {
      style: {
        fontSize: "2rem",
        fontWeight: "bold",
        marginBottom: "30px"
      },
      children: "Admin Support Dashboard"
    }), /* @__PURE__ */ jsxs("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "40px"
      },
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h2", {
          style: {
            fontSize: "1.5rem",
            marginBottom: "20px"
          },
          children: "Tenants"
        }), /* @__PURE__ */ jsx("div", {
          style: {
            background: "white",
            border: "1px solid #e4e4e7",
            borderRadius: "8px"
          },
          children: tenants.map((t) => /* @__PURE__ */ jsxs("div", {
            style: {
              padding: "15px",
              borderBottom: "1px solid #e4e4e7",
              display: "flex",
              justifyContent: "space-between"
            },
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("strong", {
                children: t.name
              }), " (", t.slug, ")", /* @__PURE__ */ jsxs("div", {
                style: {
                  fontSize: "0.8rem",
                  color: "#71717a"
                },
                children: ["ID: ", t.id]
              })]
            }), /* @__PURE__ */ jsx("button", {
              onClick: () => alert("TODO: List users for this tenant to impersonate"),
              style: {
                padding: "6px 12px",
                background: "#f4f4f5",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer"
              },
              children: "View Users"
            })]
          }, t.id))
        })]
      }), /* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h2", {
          style: {
            fontSize: "1.5rem",
            marginBottom: "20px"
          },
          children: "System Logs"
        }), /* @__PURE__ */ jsx("div", {
          style: {
            background: "#18181b",
            color: "#22c55e",
            padding: "20px",
            borderRadius: "8px",
            fontSize: "0.875rem",
            height: "400px",
            overflowY: "auto"
          },
          children: logs.map((log) => /* @__PURE__ */ jsxs("div", {
            style: {
              marginBottom: "10px",
              fontFamily: "monospace"
            },
            children: [/* @__PURE__ */ jsx("span", {
              style: {
                color: "#71717a"
              },
              children: new Date(log.createdAt).toLocaleTimeString()
            }), " ", /* @__PURE__ */ jsxs("span", {
              style: {
                color: "#eab308"
              },
              children: ["[", log.action, "]"]
            }), " ", log.details]
          }, log.id))
        })]
      })]
    })]
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: admin,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-DPQTGusa.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js", "/assets/index-CMwWdKhW.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/root-hYiJjYfx.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js", "/assets/index-CMwWdKhW.js", "/assets/index-Cs1IdFfL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard": { "id": "routes/dashboard", "parentId": "root", "path": "dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard-jl96liFs.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js", "/assets/index-Cs1IdFfL.js", "/assets/index-CMwWdKhW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard.classes": { "id": "routes/dashboard.classes", "parentId": "routes/dashboard", "path": "classes", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard.classes-rDA4xq9d.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js", "/assets/index-Cs1IdFfL.js", "/assets/index-CMwWdKhW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard.classes.$id.roster": { "id": "routes/dashboard.classes.$id.roster", "parentId": "routes/dashboard.classes", "path": ":id/roster", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard.classes._id.roster-CTMa43oq.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard.classes.$id.watch": { "id": "routes/dashboard.classes.$id.watch", "parentId": "routes/dashboard.classes", "path": ":id/watch", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard.classes._id.watch-DlE0mgHi.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard._index": { "id": "routes/dashboard._index", "parentId": "routes/dashboard", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard._index-X13-O7U5.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/sign-in.$": { "id": "routes/sign-in.$", "parentId": "root", "path": "sign-in/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/sign-in._-B5iHlYWR.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js", "/assets/uiComponents-BkGlm5Ew.js", "/assets/index-Cs1IdFfL.js", "/assets/index-CMwWdKhW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/sign-up.$": { "id": "routes/sign-up.$", "parentId": "root", "path": "sign-up/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/sign-up._-DfUQ3FAN.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js", "/assets/uiComponents-BkGlm5Ew.js", "/assets/index-Cs1IdFfL.js", "/assets/index-CMwWdKhW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_index-DViUaQZ9.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin": { "id": "routes/admin", "parentId": "root", "path": "admin", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin-C6NOY-vh.js", "imports": ["/assets/chunk-JMJ3UQ3L-BcnvHMJ6.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-1d69d210.js", "version": "1d69d210", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
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
  "routes/dashboard": {
    id: "routes/dashboard",
    parentId: "root",
    path: "dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/dashboard.classes": {
    id: "routes/dashboard.classes",
    parentId: "routes/dashboard",
    path: "classes",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/dashboard.classes.$id.roster": {
    id: "routes/dashboard.classes.$id.roster",
    parentId: "routes/dashboard.classes",
    path: ":id/roster",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/dashboard.classes.$id.watch": {
    id: "routes/dashboard.classes.$id.watch",
    parentId: "routes/dashboard.classes",
    path: ":id/watch",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/dashboard._index": {
    id: "routes/dashboard._index",
    parentId: "routes/dashboard",
    path: void 0,
    index: true,
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
  },
  "routes/admin": {
    id: "routes/admin",
    parentId: "root",
    path: "admin",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
