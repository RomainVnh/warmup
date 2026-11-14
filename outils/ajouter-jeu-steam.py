#!/usr/bin/env python3
"""Récupère pour un jeu Steam ses visuels officiels et la liste complète de ses succès.

Usage :  python3 outils/ajouter-jeu-steam.py <identifiant-du-jeu> <numéro-Steam>
Exemple : python3 outils/ajouter-jeu-steam.py hogwarts-legacy 990080

Le script écrit dans public/art/<identifiant>/ :
  hero.jpg (bannière), cover.jpg (jaquette), logo.png (s'il existe), shot1..4.jpg (captures), ach/ (icônes des succès)
et ajoute les succès du jeu dans shared/achievements-data.ts.
Il ne touche pas à shared/mock-data.ts ni à shared/news-data.ts : voir AJOUTER-UN-JEU.txt.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps'


def curl(url, out=None):
    cmd = ['curl', '-sfL', '--max-time', '60', '-H', 'Accept-Language: fr', url]
    if out:
        return subprocess.run(cmd + ['-o', out]).returncode == 0 and os.path.getsize(out) > 500
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def first(urls, out):
    for url in urls:
        if curl(url, out):
            return True
    if os.path.exists(out):
        os.remove(out)
    return False


def visuals(slug, appid):
    folder = f'{ROOT}/public/art/{slug}'
    os.makedirs(folder, exist_ok=True)
    query = json.dumps({'ids': [{'appid': appid}], 'context': {'language': 'french', 'country_code': 'FR'}, 'data_request': {'include_assets': True}})
    raw = subprocess.run(['curl', '-s', '--max-time', '30', '-G', 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/', '--data-urlencode', f'input_json={query}'], capture_output=True, text=True).stdout
    assets = (json.loads(raw or '{}').get('response', {}).get('store_items') or [{}])[0].get('assets', {})
    hashed = lambda key: [f'{CDN}/{appid}/{assets[key]}'] if assets.get(key) else []
    ok = {
        'hero.jpg': first(hashed('library_hero_2x') + [f'{CDN}/{appid}/library_hero_2x.jpg'] + hashed('library_hero') + [f'{CDN}/{appid}/library_hero.jpg'], f'{folder}/hero.jpg'),
        'cover.jpg': first(hashed('library_capsule_2x') + [f'{CDN}/{appid}/library_600x900_2x.jpg', f'{CDN}/{appid}/library_600x900.jpg'], f'{folder}/cover.jpg'),
        'logo.png': first(hashed('library_logo_2x') + hashed('library_logo') + [f'{CDN}/{appid}/logo.png'], f'{folder}/logo.png'),
    }
    details = json.loads(curl(f'https://store.steampowered.com/api/appdetails?appids={appid}&l=french&cc=fr') or '{}').get(str(appid), {}).get('data', {})
    shots = details.get('screenshots', [])
    picked = [shots[i] for i in (0, 2, 4, 6)] if len(shots) >= 7 else shots[:4]
    count = sum(curl(s['path_full'], f'{folder}/shot{n}.jpg') for n, s in enumerate(picked, 1))
    print(f"  visuels : {', '.join(k for k, v in ok.items() if v)} ; {count} captures" + ('' if ok['logo.png'] else " ; PAS DE LOGO (mettre logo: null dans mock-data.ts)"))
    return details


def achievements(slug, appid):
    page = curl(f'https://steamcommunity.com/stats/{appid}/achievements/?l=french')
    match = re.search(r'\\"groups\\":(\[\{.*?\}\]\}\]),\\"schema_hash', page or '', re.S)
    if not match:
        print('  succès : aucun trouvé')
        return []
    groups = json.loads(json.loads('"' + match.group(1) + '"'))
    rates = json.loads(curl(f'https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid={appid}') or '{}')
    rate = {a['name']: float(a['percent']) for a in rates.get('achievementpercentages', {}).get('achievements', [])}
    folder = f'{ROOT}/public/art/{slug}/ach'
    os.makedirs(folder, exist_ok=True)
    result = []
    for group in groups:
        for a in group['achievements']:
            if a.get('archived'):
                continue
            icon = a['icon_achieved']
            path = f'{folder}/{icon}'
            if not os.path.exists(path) and curl(f'https://shared.fastly.steamstatic.com/community_assets/images/apps/{appid}/{icon}', path):
                subprocess.run(['sips', '-Z', '128', path], capture_output=True)  # macOS : réduit l'icône ; sans effet ailleurs
            result.append({'name': a['name'].strip(), 'text': a['description'].strip(), 'hidden': bool(a['hidden']), 'rarity': round(rate.get(a['api_name'], 0), 1), 'icon': f'art/{slug}/ach/{icon}' if os.path.exists(path) else ''})
    print(f'  succès : {len(result)}')
    return result


def save_achievements(slug, items):
    path = f'{ROOT}/shared/achievements-data.ts'
    source = open(path, encoding='utf-8').read()
    start = source.index('= {') + 2
    data = json.loads(source[start:source.rindex(';')])
    data[slug] = items
    open(path, 'w', encoding='utf-8').write(source[:start] + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    if len(sys.argv) != 3 or not sys.argv[2].isdigit() or not re.fullmatch(r'[a-z0-9-]+', sys.argv[1]):
        sys.exit(__doc__)
    slug, appid = sys.argv[1], int(sys.argv[2])
    print(slug)
    info = visuals(slug, appid)
    save_achievements(slug, achievements(slug, appid))
    if info:
        print(f"  fiche Steam : {info.get('name')} · {', '.join(info.get('developers', []))} · {info.get('release_date', {}).get('date')} · {', '.join(g['description'] for g in info.get('genres', []))}")
        print(f"  résumé : {info.get('short_description')}")
