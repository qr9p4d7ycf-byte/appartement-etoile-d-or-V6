"""Fusionne les calendriers iCal (Airbnb, Booking...). Ne garde QUE des dates : nuits occupees et sejours (aucun nom, aucun detail)."""
import os, json, re, sys, urllib.request
from datetime import datetime, timedelta, timezone

SRC = {"airbnb": "ICAL_AIRBNB", "booking": "ICAL_BOOKING", "autre": "ICAL_URL"}
urls = {k: os.environ.get(v, "").strip() for k, v in SRC.items() if os.environ.get(v, "").strip()}
if not urls:
    print("Aucun calendrier configure."); sys.exit(0)

def events(raw, src):
    out = []
    raw = re.sub(r"\r?\n[ \t]", "", raw)
    for ev in raw.split("BEGIN:VEVENT")[1:]:
        s = re.search(r"DTSTART[^:]*:(\d{8})", ev); e = re.search(r"DTEND[^:]*:(\d{8})", ev)
        if not s: continue
        a = datetime.strptime(s.group(1), "%Y%m%d").date()
        b = datetime.strptime(e.group(1), "%Y%m%d").date() if e else a + timedelta(days=1)
        summ = re.search(r"SUMMARY[^:\r\n]*:(.*)", ev)
        # Airbnb : "Reserved" = vraie reservation, le reste = blocage. Autres plateformes : tout compte comme reservation.
        kind = "res" if (src != "airbnb" or (summ and "reserved" in summ.group(1).lower())) else "blk"
        out.append({"s": src, "a": a.isoformat(), "b": b.isoformat(), "k": kind})
    return out

stays = []
for k, u in urls.items():   # les liens ne sont jamais affiches
    try:
        raw = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "ignore")
    except Exception as ex:
        print("ERREUR de lecture :", k, type(ex).__name__); sys.exit(1)   # on garde l'ancien calendrier
    if "BEGIN:VCALENDAR" not in raw:
        print("ERREUR : reponse invalide pour", k); sys.exit(1)
    stays += events(raw, k)

booked = set()
for x in stays:
    d = datetime.strptime(x["a"], "%Y-%m-%d").date(); end = datetime.strptime(x["b"], "%Y-%m-%d").date()
    while d < end:
        booked.add(d.isoformat()); d += timedelta(days=1)
stays.sort(key=lambda x: (x["a"], x["s"]))

try: old = json.load(open("availability.json"))
except Exception: old = {}
now = datetime.now(timezone.utc)
if sorted(booked) == old.get("booked") and stays == old.get("stays") and str(old.get("updated", ""))[:10] == now.date().isoformat():
    print("Aucun changement."); sys.exit(0)
json.dump({"booked": sorted(booked), "updated": now.isoformat(timespec="minutes"), "sources": sorted(urls), "stays": stays}, open("availability.json", "w"))
print(len(booked), "nuits occupees,", len(stays), "sejours.")
