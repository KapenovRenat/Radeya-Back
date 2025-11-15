export default function firstLetterToEng(name: string) {
    const map: any = {
        'А':'A', 'Б':'B', 'В':'V', 'Г':'G', 'Д':'D', 'Е':'E', 'Ё':'E', 'Ж':'Z',
        'З':'Z', 'И':'I', 'Й':'Y', 'К':'K', 'Л':'L', 'М':'M', 'Н':'N', 'О':'O',
        'П':'P', 'Р':'R', 'С':'S', 'Т':'T', 'У':'U', 'Ф':'F', 'Х':'H', 'Ц':'C',
        'Ч':'C', 'Ш':'S', 'Щ':'S', 'Ы':'Y', 'Э':'E', 'Ю':'U', 'Я':'A'
    };

    const first = name.trim()[0].toUpperCase();
    return map[first] || first;
}