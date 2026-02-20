import { Puck } from "@puckeditor/core";
import "@puckeditor/core/dist/index.css";
import { puckConfig } from "~/components/website/puck-config.client";

interface Props {
    data: any;
    onPublish: (data: any) => void;
    onChange: (data: any) => void;
}

export function PuckEditorWrapper({ data, onPublish, onChange }: Props) {
    return (
        <Puck
            config={puckConfig}
            data={data}
            onPublish={onPublish}
            onChange={onChange}
        />
    );
}
