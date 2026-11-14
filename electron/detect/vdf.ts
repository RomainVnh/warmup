// Lecture du format texte de Steam (fichiers .vdf et .acf) :
//   "clé" "valeur"            ou            "clé" { ... }
// Les clés sont mises en minuscules, car Steam n'est pas constant d'un fichier à l'autre.

export interface VdfNode { [key: string]: string | VdfNode }

const MAX_DEPTH = 32;

function tokens(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let value = '';
      i += 1;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const next = text[i + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else {
          value += text[i];
          i += 1;
        }
      }
      i += 1;
      out.push(`"${value}`); // le guillemet de tête distingue un texte d'une accolade
    } else if (ch === '{' || ch === '}') {
      out.push(ch);
      i += 1;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (/\s/.test(ch)) {
      i += 1;
    } else {
      // Mot sans guillemets : rare, mais toléré.
      let value = '';
      while (i < text.length && !/[\s{}"]/.test(text[i])) {
        value += text[i];
        i += 1;
      }
      out.push(`"${value}`);
    }
  }
  return out;
}

/** Renvoie un objet vide si le texte n'est pas lisible : un fichier abîmé ne doit rien casser. */
export function parseVdf(text: string): VdfNode {
  const list = tokens(text);
  let position = 0;

  const readNode = (depth: number): VdfNode => {
    const node: VdfNode = Object.create(null) as VdfNode;
    while (position < list.length) {
      const token = list[position];
      if (token === '}') {
        position += 1;
        return node;
      }
      if (token === '{') {
        position += 1; // accolade sans clé : on l'ignore
        continue;
      }
      const key = token.slice(1).toLowerCase();
      position += 1;
      const next = list[position];
      if (next === undefined) break;
      if (next === '{') {
        position += 1;
        if (depth >= MAX_DEPTH) return node;
        node[key] = readNode(depth + 1);
      } else if (next === '}') {
        continue;
      } else {
        node[key] = next.slice(1);
        position += 1;
      }
    }
    return node;
  };

  try {
    return readNode(0);
  } catch {
    return Object.create(null) as VdfNode;
  }
}

export const vdfNode = (node: VdfNode | undefined, key: string): VdfNode | undefined => {
  const value = node?.[key];
  return value && typeof value === 'object' ? value : undefined;
};

export const vdfText = (node: VdfNode | undefined, key: string): string => {
  const value = node?.[key];
  return typeof value === 'string' ? value : '';
};
