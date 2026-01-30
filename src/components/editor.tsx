"use client";

import {
  useEditor,
  EditorContent,
  Editor as TiptapEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useState } from "react";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Table } from "@tiptap/extension-table";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

const COLORS = [
  // 기본색 (무채색)
  "#000000",
  "#545454",
  "#737373",
  "#A6A6A6",
  "#D9D9D9",
  "#FFFFFF",
  // 강조색 (붉은 계열)
  "#FF0000",
  "#FF5E5E",
  "#FF9999",
  "#C00000",
  "#E36C09",
  "#FAC08F",
  // 강조색 (푸른 계열)
  "#0070C0",
  "#00B0F0",
  "#92CDDC",
  "#002060",
  "#1F497D",
  "#C6D9F0",
  // 기타 (녹색/보라/노랑)
  "#00B050",
  "#92D050",
  "#D7E3BC",
  "#7030A0",
  "#B1A0C7",
  "#FFFF00",
];

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
}

const MenuBar = ({ editor }: { editor: TiptapEditor | null }) => {
  const [showColorPalette, setShowColorPalette] = useState(false);

  if (!editor) return null;

  const buttonClass = (isActive: boolean) =>
    `px-2 py-1 rounded text-sm font-medium transition-colors cursor-pointer ${
      isActive
        ? "bg-gray-800 text-white"
        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
    }`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50 sticky top-0 z-10 rounded-t-lg cursor-pointer">
      {/* 헤딩 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>

      <div className="w-[1px] bg-gray-300 mx-1"></div>

      {/* 스타일 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={buttonClass(editor.isActive("bold"))}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={buttonClass(editor.isActive("italic"))}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={buttonClass(editor.isActive("underline"))}
      >
        U
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={buttonClass(editor.isActive("strike"))}
      >
        S
      </button>

      <div className="w-[1px] bg-gray-300 mx-1"></div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowColorPalette(!showColorPalette)}
          className={`flex flex-col items-center justify-center px-3 py-1 rounded border transition-colors ${
            showColorPalette
              ? "bg-gray-200 border-gray-400"
              : "bg-white border-gray-300 hover:bg-gray-100"
          }`}
        >
          <span className="text-xs font-bold leading-none">A</span>
          <div
            className="w-4 h-1 mt-0.5 rounded-full"
            style={{
              backgroundColor:
                editor.getAttributes("textStyle").color || "#000",
            }}
          ></div>
        </button>

        {/* ✅ 클릭 시 나타나는 24색 팔레트 (Popover 형식) */}
        {showColorPalette && (
          <div className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-48">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500">글자 색상</span>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColorPalette(false);
                }}
                className="text-[10px] px-1.5 py-0.5 bg-gray-100 border rounded hover:bg-gray-200"
              >
                초기화
              </button>
            </div>

            {/* 6열 4행 그리드 */}
            <div className="grid grid-cols-6 gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setColor(color).run();
                    setShowColorPalette(false); // 선택 후 닫기
                  }}
                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* 하단 컬러 피커 (사용자 지정) */}
            <div className="mt-3 pt-2 border-t flex items-center gap-2">
              <input
                type="color"
                onInput={(event) => {
                  editor
                    .chain()
                    .focus()
                    .setColor((event.target as HTMLInputElement).value)
                    .run();
                }}
                className="w-6 h-6 cursor-pointer"
              />
              <span className="text-[10px] text-gray-400">직접 선택</span>
            </div>
          </div>
        )}
      </div>

      <div className="w-[1px] bg-gray-300 mx-1"></div>

      {/* 정렬 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={buttonClass(editor.isActive({ textAlign: "left" }))}
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={buttonClass(editor.isActive({ textAlign: "center" }))}
      >
        ↔
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={buttonClass(editor.isActive({ textAlign: "right" }))}
      >
        →
      </button>

      <div className="w-[1px] bg-gray-300 mx-1"></div>

      {/* 리스트 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={buttonClass(editor.isActive("bulletList"))}
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={buttonClass(editor.isActive("orderedList"))}
      >
        1. List
      </button>

      {/* 기타 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={buttonClass(false)}
      >
        — Line
      </button>
      <div className="w-[1px] bg-gray-300 mx-1"></div>

      {/* ✅ [표 관련 버튼 추가] */}
      <button
        type="button"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        className={buttonClass(false)}
        title="표 삽입 (3x3)"
      >
        표 삽입
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className={buttonClass(false)}
        title="행 추가"
      >
        +행
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteRow().run()}
        className={buttonClass(false)}
        title="행 삭제"
      >
        -행
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className={buttonClass(false)}
        title="오른쪽에 열 추가"
      >
        +열
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className={buttonClass(false)}
        title="열 삭제"
      >
        -열
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className={buttonClass(false)}
        title="표 삭제"
      >
        표 삭제
      </button>
    </div>
  );
};

export default function Editor({ content, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
    ],
    content: content,
    editorProps: {
      attributes: {
        class: "prose-editor focus:outline-none p-4 min-h-[400px]",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // 초기 content가 변경되었을 때 에디터에 반영 (옵션)
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      // editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
      <MenuBar editor={editor} />
      <div className="max-h-[500px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
