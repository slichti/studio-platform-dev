
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, Link as LinkIcon, Image as ImageIcon, Code, Type, Unlink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RichTextImageModal } from './RichTextImageModal';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

const MenuBar = ({ editor, onImageClick }: { editor: any, onImageClick: () => void }) => {
    if (!editor) {
        return null;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-zinc-50 rounded-t-lg">
            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-zinc-200 ${editor.isActive('bold') ? 'bg-zinc-200 text-black' : 'text-zinc-500'}`}><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-zinc-200 ${editor.isActive('italic') ? 'bg-zinc-200 text-black' : 'text-zinc-500'}`}><Italic className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-zinc-300 mx-1 self-center" />
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded hover:bg-zinc-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-zinc-200 text-black' : 'text-zinc-500'}`}><Type className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-zinc-200 ${editor.isActive('bulletList') ? 'bg-zinc-200 text-black' : 'text-zinc-500'}`}><List className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded hover:bg-zinc-200 ${editor.isActive('codeBlock') ? 'bg-zinc-200 text-black' : 'text-zinc-500'}`}><Code className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-zinc-300 mx-1 self-center" />
            <button type="button" onClick={setLink} className={`p-1.5 rounded hover:bg-zinc-200 ${editor.isActive('link') ? 'bg-zinc-200 text-black' : 'text-zinc-500'}`}><LinkIcon className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-500 disabled:opacity-30"><Unlink className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-zinc-300 mx-1 self-center" />
            <button type="button" onClick={onImageClick} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-500"><ImageIcon className="w-4 h-4" /></button>
        </div>
    );
};

export default function RichTextEditorInternal({ value, onChange, placeholder, className }: RichTextEditorProps) {
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const extensions = useMemo(() => [
        StarterKit,
        Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
        Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full my-4 border border-zinc-200' } }),
        Placeholder.configure({ placeholder: placeholder || 'Write something...' }),
    ], [placeholder]);

    const editor = useEditor({
        extensions,
        content: value,
        editorProps: { attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4' } },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            if (editor.getText() === '' && value) {
                editor.commands.setContent(value);
            }
        }
    }, [value, editor]);

    return (
        <div className={`border border-zinc-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 ${className}`}>
            <MenuBar editor={editor} onImageClick={() => setIsImageModalOpen(true)} />
            <EditorContent editor={editor} />
            <RichTextImageModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                onSelect={(url) => editor?.chain().focus().setImage({ src: url }).run()}
            />
        </div>
    );
}
