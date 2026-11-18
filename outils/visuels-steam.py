#!/usr/bin/env python3
"""Adresses exactes des visuels Steam du catalogue (bannière, jaquette, logo) et des images d'actualités.

Les jeux récents rangent leurs visuels dans des dossiers à code (« 9412a8…/library_hero.jpg ») :
l'adresse standard ne marche pas pour eux. Ce script demande à Steam les vraies adresses, vérifie
qu'elles répondent, et écrit shared/catalogue-steam-assets.ts. Aucune image n'est téléchargée ni ajoutée au dépôt.

Usage : python3 outils/visuels-steam.py
"""
import json
import os
import re
import subprocess
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = 'https://shared.akamai.steamstatic.com/store_item_assets/'
CLAN = 'https://clan.akamai.steamstatic.com/images'
MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']


def curl(url, *args):
    return subprocess.run(['curl', '-s', '--max-time', '30', *args, url], capture_output=True, text=True).stdout


def alive(url):
    code = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '20', '-I', url], capture_output=True, text=True).stdout
    return code == '200'


def catalogue_ids():
    text = open(f'{ROOT}/shared/catalogue-steam.ts', encoding='utf-8').read()
    block = text.split('CATALOGUE_STEAM_IDS')[1].split('};')[0]
    return dict(re.findall(r"'([a-z0-9-]+)':\s*'(\d+)'", block))


def assets(ids):
    query = json.dumps({'ids': [{'appid': int(a)} for a in ids.values()], 'context': {'language': 'french', 'country_code': 'FR'}, 'data_request': {'include_assets': True}})
    raw = curl('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/', '-G', '--data-urlencode', f'input_json={query}')
    items = {str(i.get('appid')): i.get('assets', {}) for i in json.loads(raw or '{}').get('response', {}).get('store_items', [])}
    result = {}
    for slug, appid in ids.items():
        a = items.get(appid, {})
        fmt = a.get('asset_url_format', '')
        url = lambda key: STORE + fmt.replace('${FILENAME}', a[key]) if fmt and a.get(key) else None
        pick = lambda *keys: next((u for u in (url(k) for k in keys) if u and alive(u)), None)
        found = {
            'art': pick('library_hero_2x', 'library_hero'),
            'cover': pick('library_capsule_2x', 'library_capsule'),
            'logo': pick('library_logo_2x', 'library_logo') or next((u for u in (f'{STORE}steam/apps/{appid}/logo_2x.png', f'{STORE}steam/apps/{appid}/logo.png') if alive(u)), None),
            'header': pick('header_2x', 'header'),
        }
        result[slug] = {k: v for k, v in found.items() if v}
        # Quatre captures d'écran officielles, en 1920 × 1080, réparties dans la galerie du jeu.
        details = json.loads(curl(f'https://store.steampowered.com/api/appdetails?appids={appid}&l=french&cc=fr&filters=screenshots') or '{}')
        shots = [x['path_full'] for x in ((details.get(appid) or {}).get('data') or {}).get('screenshots', []) if str(x.get('path_full', '')).startswith(STORE)]
        picked = [shots[i] for i in (0, 2, 4, 6)] if len(shots) >= 7 else shots[:4]
        if picked:
            result[slug]['shots'] = picked
        missing = [k for k in ('art', 'cover', 'logo') if k not in result[slug]]
        print(f'{slug} : {", ".join(result[slug]) or "rien"}' + (f' (manque : {", ".join(missing)})' if missing else ''))
    return result


def french_date(text):
    m = re.match(r'(\d+)(?:er)?\s+(\S+)\s+(\d{4})', text)
    if not m or m.group(2) not in MONTHS:
        return None
    return datetime(int(m.group(3)), MONTHS.index(m.group(2)) + 1, int(m.group(1))).date()


def news_images(ids):
    text = open(f'{ROOT}/shared/news-data.ts', encoding='utf-8').read()
    news = json.loads(text.split('= ', 1)[1].rsplit(';', 1)[0])
    result = {}
    for slug, items in news.items():
        appid = ids.get(slug)
        if not appid:
            continue
        raw = curl(f'https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/?appid={appid}&count_before=0&count_after=40&l=french')
        events = []
        for e in json.loads(raw or '{}').get('events', []):
            try:
                data = json.loads(e.get('jsondata') or '{}')
            except ValueError:
                data = {}
            data = data if isinstance(data, dict) else {}
            body = e.get('announcement_body') or {}
            body = body if isinstance(body, dict) else {}
            clan = body.get('clanid')
            images = data.get('localized_capsule_image') or []
            image = (images[2] if len(images) > 2 and images[2] else None) or (images[0] if images else None)
            url = f'{CLAN}/{clan}/{image}' if clan and image else None
            if not url:
                # Sans image de couverture : la première image de l'article.
                m = re.search(r'\{STEAM_CLAN_IMAGE\}/(\d+)/([\w.-]+\.(?:png|jpe?g|gif|webp))', body.get('body') or '')
                url = f'{CLAN}/{m.group(1)}/{m.group(2)}' if m else None
            if url:
                events.append((datetime.fromtimestamp(e['rtime32_start_time'], timezone.utc).date(), url))
        # Chaque annonce ne sert qu'une fois : le même jour, elles sont prises dans l'ordre de Steam (la plus récente d'abord).
        found = []
        used = set()
        for item in items:
            day = french_date(item.get('date', ''))
            candidates = sorted((abs((d - day).days), i) for i, (d, _) in enumerate(events) if day and i not in used and abs((d - day).days) <= 1)
            match = None
            for _, i in candidates:
                used.add(i)
                # L'éditeur réutilise parfois la même image : elle ne sert qu'une fois, les autres prennent une capture du jeu.
                if events[i][1] not in found and alive(events[i][1]):
                    match = events[i][1]
                    break
            found.append(match)
        result[slug] = found
        print(f'{slug} : {sum(1 for f in found if f)} image(s) d\'actualité sur {len(items)}')
    return result


def main():
    ids = catalogue_ids()
    art = assets(ids)
    news = news_images(ids)
    out = [
        '// Fichier généré par outils/visuels-steam.py : ne pas modifier à la main.',
        '// Adresses exactes des visuels officiels chez Steam (aucune image dans le dépôt).',
        '',
        'export interface SteamAssets { art?: string; cover?: string; logo?: string; header?: string; shots?: string[] }',
        '',
        f'export const STEAM_ASSETS: Record<string, SteamAssets> = {json.dumps(art, indent=2, ensure_ascii=False)};',
        '',
        '/** Image de chaque actualité, dans l\'ordre de shared/news-data.ts (null : aucune image chez Steam). */',
        f'export const NEWS_IMAGES: Record<string, (string | null)[]> = {json.dumps(news, indent=2, ensure_ascii=False)};',
        '',
    ]
    open(f'{ROOT}/shared/catalogue-steam-assets.ts', 'w', encoding='utf-8').write('\n'.join(out))
    print('shared/catalogue-steam-assets.ts écrit.')


if __name__ == '__main__':
    main()
