import { json } from "react-router";

export const loader = async () => {
    return json({ message: "Worker Alive (Plain)", version: process.version });
};

export default function TestPlain() {
    return <h1>Test Plain Route - Worker Alive</h1>;
}
