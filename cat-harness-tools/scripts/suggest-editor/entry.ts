// The ✍ suggest editor's one browser module: Crepe, and what the dialog's
// toolbar and change marks need, all from ONE copy of Milkdown and
// ProseMirror. `suggest-editor.ts` bundles it, adding as the default export
// the KaTeX Crepe itself depends on (resolved through Crepe, not declared
// here: a second KaTeX beside the root's would shadow it).
export { Crepe } from "@milkdown/crepe";
// The toolbar: Milkdown's own commands, run through the editor's context.
export { callCommand } from "@milkdown/kit/utils";
export {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
} from "@milkdown/kit/preset/commonmark";
export { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
export { undoCommand, redoCommand } from "@milkdown/kit/plugin/history";
// The change marks: a ProseMirror plugin decorating what differs from the source.
export { Plugin, PluginKey } from "@milkdown/kit/prose/state";
export { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
