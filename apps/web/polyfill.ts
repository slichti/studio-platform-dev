// Polyfill MessageChannel if missing (required by React 19 / Scheduler in some envs)
if (typeof MessageChannel === "undefined") {
    // @ts-ignore
    globalThis.MessageChannel = class MessageChannel {
        port1: any;
        port2: any;
        constructor() {
            this.port1 = { onmessage: null, postMessage: (msg: any) => { if (this.port2.onmessage) this.port2.onmessage({ data: msg }); } };
            this.port2 = { onmessage: null, postMessage: (msg: any) => { if (this.port1.onmessage) this.port1.onmessage({ data: msg }); } };
        }
    };
}
