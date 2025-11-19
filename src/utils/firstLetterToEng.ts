const map: Record<string, string> = {
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Z',
    'З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O',
    'П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H','Ц':'C',
    'Ч':'C','Ш':'S','Щ':'S','Ы':'Y','Э':'E','Ю':'U','Я':'A',

    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'z',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c',
    'ч':'c','ш':'s','щ':'s','ы':'y','э':'e','ю':'u','я':'a',

    // ь ъ — удаляем
    'ь':'','Ь':'',
    'ъ':'','Ъ':'',
};


export function firstLetterToEng(name: string) {
    const first = name.trim()[0].toUpperCase();

    return map[first] || first;
}

export function capitalize(str: string) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function translit(str: string): string {
    return str
        .split('')
        .map(ch => map[ch] ?? ch)  // если символ есть в карте → переводим
        .join('')
        .replace(/[^a-zA-Z0-9\-_. ]/g, '') // удаляем всё нелатинское
        .replace(/\s+/g, '-')              // пробел → "-"
        .replace(/-+/g, '-')               // несколько "-" → одно
        .replace(/^-|-$/g, '')             // убираем "-" в начале/конце
        .toLowerCase();                    // для пути лучше lowercase
}