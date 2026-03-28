# Gelismis Discord Destek Botu

Bu proje, `discord.js v14` ile yazilmis gelismis bir destek botudur.

Ozellikler:

- Secim menulu destek paneli
- Kategori bazli ozel ticket acma
- Embed log sistemi
- Ticket kapanisinda otomatik yorum/puan DM'i
- Yetkili tarafinda ticket ustlenme
- Ticket icinden tek butonla uye yonetimi
- Ticket kapanisinda transkript olusturma
- Kapanis sonrasi kullanicidan yorum/puan alma
- Yetkililer icin manuel embed DM gonderme komutu

## Kurulum

1. Bagimliliklari kur:

```bash
npm install
```

2. `.env.example` dosyasini `.env` olarak kopyala ve doldur:

```env
DISCORD_TOKEN=bot-token-buraya
CLIENT_ID=uygulama-client-id
GUILD_ID=test-icin-sunucu-id
```

`GUILD_ID`, test asamasinda komutlarin daha hizli gelmesi icin onerilir.

3. Boti baslat:

```bash
npm start
```

## Discord Icinde Kullanim

1. `/kurulum` ile kategori, log kanali ve yetkili rolunu tanimla.
2. `/panel` ile kullanicilarin gorecegi destek panelini gonder.
3. Kullanici panelden kategori sectiginde bot ozel bir ticket kanali acar.
4. Yetkililer butonlarla talebi ustlenebilir, uye yonetimi yapabilir veya kapatabilir.
5. Ticket kapaninca log kanalina transkript gider ve kullaniciya DM uzerinden puanlama istegi yollanir.

## Notlar

- Botun DM gonderebilmesi icin kullanicinin ozel mesajlari acik olmali.
- Otomatik DM sadece ticket kapanisinda yorum almak icin gonderilir.
- Ticket kanali, `/kurulum` sirasinda verilen kategori altinda olusturulur.
- Log kanali sadece yazi kanali olmali.
