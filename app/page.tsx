"use client";

import {
  FormEvent,
  PointerEvent,
  useEffect,
  useSyncExternalStore,
  useRef,
  useState,
} from "react";

type Language = "ru" | "en";
type Localized = { ru: string; en: string };

type ServicePoint = {
  text: Localized;
  children?: Localized[];
};

type ServiceRate = {
  amount: string;
  label: Localized;
};

type Service = {
  number: string;
  title: Localized;
  price: Localized;
  rates?: ServiceRate[];
  includes: ServicePoint[];
  suitable?: Localized;
  note?: Localized;
};

type Article = {
  tag: Localized;
  title: Localized;
  text: Localized;
  time: Localized;
};

type AboutPhoto = {
  src: string;
  alt: Localized;
  position?: string;
};

const copy = {
  ru: {
    brandAria: "OZ SPA — на главную",
    nav: {
      about: "Обо мне",
      services: "Процедуры",
      journal: "Полезно",
      gallery: "Работы",
      book: "Записаться",
      menu: "Меню",
      close: "Закрыть",
    },
    hero: {
      eyebrowRole: "Трихолог",
      eyebrow: "Специалист по комплексному уходу за волосами и кожей головы",
      title: "Волосы, к которым хочется",
      titleEm: "прикасаться.",
      lead: "Разбираюсь в состоянии кожи головы и длины, чтобы собрать уход, который подходит именно вам — бережно, понятно, надолго.",
      choose: "Выбрать время и дату",
      procedures: "Посмотреть процедуры",
      notes: ["Диагностика", "Протокол", "Поддержка"],
      imageAlt: "Длинные волосы в солнечном свете",
      noteTop: "Уход без перегруза",
      noteTopSmall: "естественный результат",
      noteBottomSmall: "Главное",
      noteBottom: "понять причину",
    },
    ticker: ["Кожа головы", "Реконструкция", "Мягкий уход", "Живые волосы"],
    about: {
      label: "Обо мне",
      caption: "бережная работа|с каждой прядью",
      prevSlide: "Предыдущий слайд",
      nextSlide: "Следующий слайд",
      slideLabel: "Слайд",
      slides: [
        "Я Ольга, сертифицированный трихолог и специалист по восстановлению волос",
        "Я верю, что красивые и здоровые на вид волосы начинаются не с одной процедуры, а с понимания их состояния и правильного ухода.",
        "В своей работе я придерживаюсь спокойного, индивидуального подхода — без громких обещаний, универсальных решений и ожиданий мгновенного результата. У каждого человека своя история волос: окрашивания, термические воздействия, домашний уход, изменения в организме и другие факторы, которые могут влиять на их состояние.",
        "Поэтому прежде чем выбирать процедуру, я внимательно выслушиваю ваши пожелания, изучаю состояние кожи головы и волос, задаю вопросы и помогаю определить, какой уход будет наиболее уместен именно в вашем случае.",
        "Моя задача — не просто улучшить внешний вид волос, а помочь вам лучше понимать их потребности.",
        "На встрече мы не ограничиваемся уходом в кресле. Вы получаете рекомендации по домашнему уходу, понимаете, какие привычки стоит пересмотреть, чего лучше избегать и как отслеживать изменения со временем. При необходимости мы обсуждаем дальнейший план процедур и домашней поддержки.",
        "Я работаю с качеством волос, их прочностью, эластичностью, гладкостью и внешним видом, уделяя внимание состоянию кожи головы. Если замечаю признаки, которые могут требовать медицинской оценки, рекомендую обратиться к соответствующему специалисту.",
        "Для меня важно, чтобы вы уходили не только с ощущением ухоженных волос, но и с ясным пониманием дальнейших шагов.",
        "Без спешки. Без лишних обещаний. С вниманием к вашим волосам и результату, который мы выстраиваем последовательно.",
      ],
      signature: "ЖГИРОВА ОЛЬГА — ваш специалист по волосам",
      certificatesTitle: "Мои дипломы и сертификаты",
      prevCertificate: "Предыдущий документ",
      nextCertificate: "Следующий документ",
      certificate: "Документ",
      processLabel: "Как всё проходит",
      process: [
        ["Слушаем", "что изменилось и чего хочется"],
        ["Смотрим", "кожа головы, длина, текстура"],
        ["Собираем", "процедура и план поддержки"],
      ],
    },
    services: {
      label: "Процедуры",
      title: "Выбираем не модное.",
      titleEm: "Выбираем ваше.",
      aside:
        "Каждая встреча начинается с вопросов и заканчивается планом, который можно поддерживать в обычной жизни.",
      details: "Подробнее",
      includes: "Включает",
      suitable: "Подходит, если у вас",
      more: "Дополнительные услуги",
      notSure: "Не знаете, что выбрать?",
      message: "Напишите — помогу сориентироваться",
    },
    instagram: {
      label: "Видео и объяснения",
      title: "Загляните в",
      titleEm: "Instagram.",
      text: "Показываю процедуры изнутри, объясняю сложное простыми словами и делюсь маленькими привычками, которые меняют состояние волос.",
      open: "Открыть профиль",
    },
    gallery: {
      label: "Работы",
      title: "Тактильный результат.",
      text: "Смотрите на текстуру, блеск и движение волос — не только на картинку «до и после».",
      study: "изучение текстуры",
      alts: [
        "Длинные волосы в мягком солнечном свете",
        "Профессиональный уход за волосами",
        "Естественная текстура длинных волос",
        "Женский портрет с длинными волосами",
      ],
    },
    journal: {
      label: "Журнал о волосах",
      title: "Полезное, которое хочется",
      titleEm: "сохранить.",
      all: "Все материалы",
      read: "Читать статью",
    },
    booking: {
      label: "Запись на встречу",
      title: "Начнём с",
      titleEm: "разговора.",
      text: "Выберите дату и время, оставьте контакты — я подтвержу запись и задам несколько вопросов перед встречей.",
      location: "Лос Анджелес · очно",
      schedule: "Пн–Сб · 10:00–20:00",
      date: "Дата",
      time: "Время",
      pickDate: "Выберите день",
      pickTime: "Выберите время",
      name: "Ваше имя",
      namePlaceholder: "Как к вам обращаться?",
      contact: "Телефон или Instagram",
      contactPlaceholder: "Где с вами связаться?",
      interest: "Что вас интересует?",
      select: "Выберите направление",
      serviceOptions: [
        "Диагностика кожи головы и волос",
        "Детокс кожи головы и балансирующий ритуал",
        "Полный ритуал восстановления волос",
        "Базовое восстановление",
        "Окрашивание в один тон + базовый уход",
        "Окрашивание в один тон + полное восстановление",
        "Мытьё и укладка по типу волос",
        "Подравнивание кончиков",
        "Укладка",
        "Пока не знаю",
      ],
      message: "Сообщение",
      optional: "необязательно",
      messagePlaceholder: "Расскажите, что происходит с волосами",
      submit: "Отправить заявку",
      privacy:
        "Нажимая кнопку, вы соглашаетесь на обработку персональных данных.",
      successTitle: "Заявка принята.",
      successText:
        "Спасибо. Я подтвержу выбранные дату и время в ближайшее время.",
      another: "Отправить ещё одну заявку",
    },
    footer: {
      label:
        "Трихолог · специалист по восстановлению волос и уходу за кожей головы",
      copyright: "© 2026 · с заботой о ваших волосах",
    },
  },
  en: {
    brandAria: "OZ SPA — home",
    nav: {
      about: "About",
      services: "Treatments",
      journal: "Journal",
      gallery: "Work",
      book: "Book a visit",
      menu: "Menu",
      close: "Close",
    },
    hero: {
      eyebrowRole: "Trichology",
      eyebrow: "hair restoration specialist and scalp treatment",
      title: "Hair you want to",
      titleEm: "reach for.",
      lead: "I look at the scalp and the lengths together, then build a care plan that fits you — gentle, clear, and made to last.",
      choose: "Choose date and time",
      procedures: "Explore treatments",
      notes: ["Diagnosis", "Protocol", "Support"],
      imageAlt: "Long hair in warm sunlight",
      noteTop: "Care without overload",
      noteTopSmall: "a natural result",
      noteBottomSmall: "First step",
      noteBottom: "understand the cause",
    },
    ticker: ["Scalp care", "Reconstruction", "Gentle rituals", "Living hair"],
    about: {
      label: "About",
      caption: "gentle work|with every strand",
      prevSlide: "Previous slide",
      nextSlide: "Next slide",
      slideLabel: "Slide",
      slides: [
        "I'm Olga, a certified trichologist and hair restoration specialist",
        "I believe hair that looks beautiful and healthy begins not with a single treatment, but with understanding its condition and the right care.",
        "I work in a calm, individual way — without loud promises, one-size-fits-all solutions, or the expectation of an instant result. Everyone's hair has its own history: colour, heat, home care, changes in the body, and other factors that can affect how it feels.",
        "So before choosing a treatment, I listen carefully to what you want, look at the scalp and the hair, ask questions, and help decide which care fits your case.",
        "My task is not only to improve how the hair looks, but to help you understand what it needs.",
        "A visit is more than care in the chair. You leave with home-care recommendations, a clearer sense of which habits to reconsider, what to avoid, and how to notice change over time. When it is useful, we talk through a further plan for treatments and support at home.",
        "I work with the quality of the hair — its strength, elasticity, smoothness, and appearance — and I pay attention to the scalp. If I notice signs that may need a medical assessment, I recommend seeing the right specialist.",
        "What matters to me is that you leave not only with the feeling of cared-for hair, but with a clear sense of the next steps.",
        "Without rush. Without extra promises. With attention to your hair, and to a result we build step by step.",
      ],
      signature: "OLGA ZHGIROVA — your hair specialist",
      certificatesTitle: "My diplomas and certificates",
      prevCertificate: "Previous document",
      nextCertificate: "Next document",
      certificate: "Document",
      processLabel: "The process",
      process: [
        ["Listen", "what changed and what you want"],
        ["Look", "scalp, lengths, texture"],
        ["Build", "treatment and support plan"],
      ],
    },
    services: {
      label: "Treatments",
      title: "Not what is trending.",
      titleEm: "What is yours.",
      aside:
        "Every visit starts with questions and ends with a plan you can actually keep up with in everyday life.",
      details: "Details",
      includes: "Includes",
      suitable: "A good fit if you have",
      more: "Additional services",
      notSure: "Not sure where to start?",
      message: "Write to me — I will help you choose",
    },
    instagram: {
      label: "Videos and explainers",
      title: "Visit",
      titleEm: "Instagram.",
      text: "See treatments from the inside, get clear explanations, and find small habits that change the way your hair feels.",
      open: "Open profile",
    },
    gallery: {
      label: "Work",
      title: "A tactile result.",
      text: "Look for texture, shine, and movement — not only a before-and-after picture.",
      study: "texture study",
      alts: [
        "Long hair in soft sunlight",
        "Professional hair treatment",
        "Natural long hair texture",
        "Woman with long hair in warm light",
      ],
    },
    journal: {
      label: "The hair journal",
      title: "Useful things worth",
      titleEm: "saving.",
      all: "All articles",
      read: "Read article",
    },
    booking: {
      label: "Book a visit",
      title: "Let’s start with a",
      titleEm: "conversation.",
      text: "Choose a date and time, leave your details — I will confirm the visit and ask a few questions beforehand.",
      location: "Los Angeles · in person",
      schedule: "Mon–Sat · 10:00–20:00",
      date: "Date",
      time: "Time",
      pickDate: "Choose a day",
      pickTime: "Choose a time",
      name: "Your name",
      namePlaceholder: "What should I call you?",
      contact: "Phone or Instagram",
      contactPlaceholder: "Where can I reach you?",
      interest: "What are you looking for?",
      select: "Choose a direction",
      serviceOptions: [
        "Scalp and hair diagnosis",
        "Scalp detox and balancing ritual",
        "Full hair restoration ritual",
        "Basic restoration",
        "Single-tone colour and basic care",
        "Single-tone colour and full restoration",
        "Wash and style",
        "Trim",
        "Styling",
        "Not sure yet",
      ],
      message: "Message",
      optional: "optional",
      messagePlaceholder: "Tell me what is happening with your hair",
      submit: "Send request",
      privacy:
        "By sending this form, you agree to the processing of personal data.",
      successTitle: "Request received.",
      successText:
        "Thank you. I will confirm the date and time you chose shortly.",
      another: "Send another request",
    },
    footer: {
      label: "Trichology · hair restoration specialist and scalp treatment",
      copyright: "© 2026 · made with care for your hair",
    },
  },
} as const;

const imageBase = "https://images.unsplash.com/";

const personalReview: ServicePoint = {
  text: {
    ru: "Персональный разбор состояния волос и кожи головы: разбор анализов крови, дефициты, рекомендации по питанию и образу жизни",
    en: "A personal review of your hair and scalp: bloodwork, deficiencies, and recommendations for nutrition and lifestyle",
  },
};

const careRecommendations: ServicePoint = {
  text: {
    ru: "Рекомендации по уходу и подбор профессиональных продуктов",
    en: "Care recommendations and a selection of professional products",
  },
};

const resultNote: Localized = {
  ru: "Результат процедуры сохраняется в среднем до 1 месяца — в зависимости от типа волос и домашнего ухода.",
  en: "The result lasts about a month on average, depending on your hair type and home care.",
};

const services: Service[] = [
  {
    number: "01",
    title: {
      ru: "Диагностика кожи головы и волос (трихоскопия)",
      en: "Scalp and hair diagnosis (trichoscopy)",
    },
    price: { ru: "$50", en: "$50" },
    includes: [
      {
        text: {
          ru: "Анализ кожи головы с помощью трихоскопа",
          en: "Scalp analysis with a trichoscope",
        },
      },
      {
        text: {
          ru: "Оценка плотности и состояния волос",
          en: "Assessment of hair density and condition",
        },
      },
      {
        text: {
          ru: "Проверка пористости и накоплений",
          en: "A check of porosity and buildup",
        },
      },
      personalReview,
      careRecommendations,
    ],
    suitable: {
      ru: "Выпадение волос, сухость и стянутость кожи головы, жирность, перхоть и неопределённое состояние кожи головы",
      en: "Hair loss, a dry or tight scalp, oiliness, dandruff, or an unclear scalp condition",
    },
  },
  {
    number: "02",
    title: {
      ru: "Детокс кожи головы и балансирующий ритуал",
      en: "Scalp detox and balancing ritual",
    },
    price: { ru: "$100–$130", en: "$100–$130" },
    rates: [
      {
        amount: "$100",
        label: { ru: "короткие волосы", en: "short hair" },
      },
      {
        amount: "$130",
        label: { ru: "ниже плеч", en: "below the shoulders" },
      },
    ],
    includes: [
      {
        text: {
          ru: "Диагностика кожи головы и волос с помощью трихоскопа",
          en: "Scalp and hair diagnosis with a trichoscope",
        },
      },
      personalReview,
      {
        text: {
          ru: "Глубокое очищение кожи головы",
          en: "A deep scalp cleanse",
        },
      },
      {
        text: {
          ru: "Удаление накоплений",
          en: "Buildup removal",
        },
      },
      {
        text: {
          ru: "Маска для кожи головы",
          en: "A scalp mask",
        },
      },
      {
        text: {
          ru: "Массаж для улучшения микроциркуляции",
          en: "Massage to support microcirculation",
        },
      },
      {
        text: {
          ru: "Увлажняющее и балансирующее восстановление",
          en: "Moisturising, balancing restoration",
        },
      },
      {
        text: {
          ru: "Питание волос по длине",
          en: "Nourishment along the lengths",
        },
      },
      careRecommendations,
    ],
    suitable: {
      ru: "Выпадение волос, сухость и стянутость кожи головы, жирность, перхоть, неопределённое состояние кожи головы, сухие и ломкие волосы по длине",
      en: "Hair loss, a dry or tight scalp, oiliness, dandruff, an unclear scalp condition, or dry, brittle lengths",
    },
  },
  {
    number: "03",
    title: {
      ru: "Полный ритуал восстановления волос",
      en: "Full hair restoration ritual",
    },
    price: { ru: "$150–$280", en: "$150–$280" },
    rates: [
      {
        amount: "$150",
        label: { ru: "короткие, ниже ушей, каре", en: "short, below the ears, a bob" },
      },
      {
        amount: "$170",
        label: { ru: "до плеч", en: "to the shoulders" },
      },
      {
        amount: "$200",
        label: { ru: "густые, до плеч", en: "thick hair to the shoulders" },
      },
      {
        amount: "$250",
        label: { ru: "длинные волосы", en: "long hair" },
      },
      {
        amount: "$280",
        label: { ru: "длинные густые волосы", en: "long, thick hair" },
      },
    ],
    includes: [
      {
        text: {
          ru: "Диагностика кожи головы и волос с помощью трихоскопа",
          en: "Scalp and hair diagnosis with a trichoscope",
        },
      },
      personalReview,
      {
        text: {
          ru: "Детокс и очищение кожи головы: скраб и специальная маска для скальпа. Последовательность и количество шагов зависят от состояния кожи головы",
          en: "Scalp detox and cleanse: a scrub and a scalp mask. The sequence and number of steps depend on the condition of the scalp",
        },
      },
      {
        text: {
          ru: "Реконструкция длины — процедура подбирается индивидуально",
          en: "Length reconstruction, chosen individually for the condition of the hair",
        },
      },
      {
        text: {
          ru: "Интенсивное увлажнение и питание",
          en: "Intensive moisture and nourishment",
        },
      },
      {
        text: {
          ru: "Запечатывание кутикулы",
          en: "Cuticle sealing",
        },
      },
      {
        text: {
          ru: "Укладка феном",
          en: "Blow-dry",
        },
      },
    ],
    suitable: {
      ru: "Перхоть, выпадение волос, неокрашенные, но сухие и ломкие по длине, повреждённые волосы, окрашенные и сухие волосы",
      en: "Dandruff, hair loss, uncoloured hair that is dry and breaking, damaged hair, or coloured, dry hair",
    },
    note: resultNote,
  },
  {
    number: "04",
    title: {
      ru: "Базовое восстановление (экспресс-уход)",
      en: "Basic restoration (express care)",
    },
    price: { ru: "$100", en: "$100" },
    includes: [
      {
        text: {
          ru: "Очищающий шампунь и скраб для кожи головы",
          en: "Cleansing shampoo and a scalp scrub",
        },
      },
      {
        text: {
          ru: "Экспресс-маска для восстановления и увлажнения кожи головы",
          en: "An express mask to restore and moisturise the scalp",
        },
      },
      {
        text: {
          ru: "Увлажнение волос по длине",
          en: "Moisture along the lengths",
        },
      },
      {
        text: {
          ru: "Восстановление секущихся кончиков",
          en: "Split-end repair",
        },
      },
      {
        text: {
          ru: "Укладка феном",
          en: "Blow-dry",
        },
      },
    ],
    suitable: {
      ru: "Перхоть, жирность корней, сухие секущиеся волосы",
      en: "Dandruff, oily roots, or dry, split ends",
    },
  },
  {
    number: "05",
    title: {
      ru: "Окрашивание в один тон и базовый уход",
      en: "Single-tone colour and basic care",
    },
    price: { ru: "$150", en: "$150" },
    includes: [
      {
        text: {
          ru: "Окрашивание в один тон",
          en: "Single-tone colour",
        },
      },
      {
        text: {
          ru: "Пост-уход: шампунь, маска и кондиционер",
          en: "Post-care: shampoo, mask, and conditioner",
        },
      },
      {
        text: {
          ru: "Базовое восстановление",
          en: "Basic restoration",
        },
      },
      {
        text: {
          ru: "Укладка феном",
          en: "Blow-dry",
        },
      },
    ],
  },
  {
    number: "06",
    title: {
      ru: "Окрашивание в один тон и полное восстановление",
      en: "Single-tone colour and full restoration",
    },
    price: { ru: "$280", en: "$280" },
    includes: [
      {
        text: {
          ru: "Окрашивание в один тон",
          en: "Single-tone colour",
        },
      },
      {
        text: {
          ru: "Диагностика скальпа и волос с помощью трихоскопа",
          en: "Scalp and hair diagnosis with a trichoscope",
        },
      },
      {
        text: {
          ru: "Профессиональное восстановление по результатам диагностики: холодная реконструкция, коллагеновое восстановление или ботокс для волос",
          en: "Professional restoration chosen from the diagnosis: cold reconstruction, collagen restoration, or hair botox",
        },
      },
      {
        text: {
          ru: "Глубокое увлажнение и питание",
          en: "Deep moisture and nourishment",
        },
      },
      {
        text: {
          ru: "Запечатывание структуры волоса",
          en: "Sealing the hair structure",
        },
      },
      {
        text: {
          ru: "Укладка феном",
          en: "Blow-dry",
        },
      },
    ],
    note: resultNote,
  },
  {
    number: "07",
    title: {
      ru: "Мытьё и укладка по типу волос",
      en: "Wash and style for your hair type",
    },
    price: { ru: "$60–$90", en: "$60–$90" },
    includes: [
      {
        text: {
          ru: "Мытьё головы с подбором шампуня под тип волос",
          en: "A wash with a shampoo matched to your hair type",
        },
      },
      {
        text: {
          ru: "Деликатное очищение кожи головы",
          en: "A gentle scalp cleanse",
        },
      },
      {
        text: {
          ru: "Кондиционирование или лёгкий уход",
          en: "Conditioning or light care",
        },
      },
      {
        text: {
          ru: "Профессиональная укладка с учётом типа волос",
          en: "Professional styling for your hair type",
        },
        children: [
          { ru: "Тонкие волосы — объём", en: "Fine hair — volume" },
          {
            ru: "Кудрявые волосы — подчёркнутая текстура",
            en: "Curly hair — defined texture",
          },
          {
            ru: "Сухие волосы — увлажняющая укладка",
            en: "Dry hair — a moisturising style",
          },
          {
            ru: "Повреждённые волосы — щадящая термозащита",
            en: "Damaged hair — gentle heat protection",
          },
        ],
      },
    ],
  },
  {
    number: "08",
    title: { ru: "Подравнивание кончиков", en: "Trim" },
    price: { ru: "$30–$50", en: "$30–$50" },
    rates: [
      {
        amount: "$50",
        label: {
          ru: "с мытьём головы: шампунь, кондиционер и маска",
          en: "with a wash: shampoo, conditioner, and mask",
        },
      },
      {
        amount: "$30",
        label: { ru: "без мытья головы", en: "without a wash" },
      },
    ],
    includes: [],
  },
  {
    number: "09",
    title: { ru: "Укладка", en: "Styling" },
    price: { ru: "$80–$100", en: "$80–$100" },
    rates: [
      {
        amount: "$100",
        label: { ru: "локоны, с мытьём головы", en: "curls, with a wash" },
      },
      {
        amount: "$80",
        label: { ru: "локоны, без мытья головы", en: "curls, without a wash" },
      },
    ],
    includes: [],
  },
];

const featuredServices = services.slice(0, 4);
const extraServices = services.slice(4);

const articles: Article[] = [
  {
    tag: { ru: "База", en: "Basics" },
    title: {
      ru: "Почему волосы быстро теряют свежесть",
      en: "Why hair loses freshness so quickly",
    },
    text: {
      ru: "О коже головы, частоте мытья и сигналах, которые не стоит игнорировать.",
      en: "About the scalp, wash frequency, and signals worth paying attention to.",
    },
    time: { ru: "5 минут чтения", en: "5 min read" },
  },
  {
    tag: { ru: "Уход", en: "Care" },
    title: {
      ru: "Как читать состав шампуня",
      en: "How to read a shampoo label",
    },
    text: {
      ru: "Небольшая памятка: на что смотреть, если кожа головы чувствительная, а длина сухая.",
      en: "A small guide to what matters when the scalp is sensitive and the lengths are dry.",
    },
    time: { ru: "7 минут чтения", en: "7 min read" },
  },
  {
    tag: { ru: "Длина", en: "Lengths" },
    title: {
      ru: "Восстановление — не только маска",
      en: "Restoration is more than a mask",
    },
    text: {
      ru: "Разбираем, из чего складывается устойчивый результат и почему ему нужен план.",
      en: "What creates a lasting result, and why it needs a plan.",
    },
    time: { ru: "6 минут чтения", en: "6 min read" },
  },
];

const galleryImages = [
  {
    src:
      imageBase +
      "photo-1702910449473-0ed91bb0dd4a?auto=format&fit=crop&w=1200&q=85",
    alt: {
      ru: "Длинные волосы в мягком солнечном свете",
      en: "Long hair in soft sunlight",
    },
    className: "gallery-image gallery-image-tall",
  },
  {
    src:
      imageBase +
      "photo-1717160675489-7779f2c91999?auto=format&fit=crop&w=1000&q=85",
    alt: {
      ru: "Профессиональный уход за волосами",
      en: "Professional hair treatment",
    },
    className: "gallery-image",
  },
  {
    src:
      imageBase +
      "photo-1567102064187-b6709041f322?auto=format&fit=crop&w=1000&q=85",
    alt: {
      ru: "Естественная текстура длинных волос",
      en: "Natural long hair texture",
    },
    className: "gallery-image",
  },
  {
    src:
      imageBase +
      "photo-1635713150362-ed0cd425e697?auto=format&fit=crop&w=1200&q=85",
    alt: {
      ru: "Женский портрет с длинными волосами",
      en: "Woman with long hair in warm light",
    },
    className: "gallery-image gallery-image-wide",
  },
];

// Previous about photo kept at /memory/about-salon.jpg.
// Add another portrait by placing a file in public/ and appending it here.
const aboutPhotos: AboutPhoto[] = [
  {
    src: "/about-01.png",
    alt: {
      ru: "Ольга в кабинете с прибором для анализа волос",
      en: "Olga in the treatment room with a hair-analysis device",
    },
    position: "50% 22%",
  },
  {
    src: "/about-02.png",
    alt: {
      ru: "Ольга проводит процедуру ухода за волосами",
      en: "Olga performing a hair care treatment",
    },
    position: "35% 18%",
  },
  {
    src: "/about-03.jpg",
    alt: {
      ru: "Длинные волосы в мягком свете",
      en: "Long wavy hair in soft light",
    },
    position: "center 30%",
  },
  {
    src: "/about-04.jpg",
    alt: {
      ru: "Процедура ухода за кожей головы",
      en: "Scalp care treatment",
    },
    position: "center 40%",
  },
  {
    src: "/about-05.jpg",
    alt: {
      ru: "Прикосновение к волосам",
      en: "A hand touching hair",
    },
    position: "center 40%",
  },
  {
    src: "/about-06.jpg",
    alt: {
      ru: "Длинные волосы на солнце",
      en: "Long hair in warm sunlight",
    },
    position: "center 30%",
  },
  {
    src: "/about-07.jpg",
    alt: {
      ru: "Блондинка приподнимает волосы",
      en: "A woman lifting her hair",
    },
    position: "center 35%",
  },
  {
    src: "/about-08.jpg",
    alt: {
      ru: "Длинные волосы в мягком свете",
      en: "Long wavy hair in soft light",
    },
    position: "center 35%",
  },
  {
    src: "/about-09.jpg",
    alt: {
      ru: "Длинные волосы на солнце",
      en: "Long hair in warm sunlight",
    },
    position: "center 35%",
  },
];

// Add a diploma or certificate by placing a file in public/ and appending it here.
const certificates: AboutPhoto[] = [];

const TIME_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function availableSlots(iso: string, now = new Date()) {
  const date = fromISODate(iso);
  if (date.getTime() !== startOfDay(now).getTime()) return TIME_SLOTS;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return TIME_SLOTS.filter((slot) => {
    const [hours, minutes] = slot.split(":").map(Number);
    return hours * 60 + minutes > minutesNow;
  });
}

function isDateOpen(iso: string, now = new Date()) {
  const date = fromISODate(iso);
  if (date.getDay() === 0) return false;
  if (date < startOfDay(now)) return false;
  return availableSlots(iso, now).length > 0;
}

function ServiceRow({
  id,
  service,
  language,
  isOpen,
  onToggle,
  detailsLabel,
  includesLabel,
  suitableLabel,
}: {
  service: Service;
  language: Language;
  isOpen: boolean;
  onToggle: () => void;
  detailsLabel: string;
  includesLabel: string;
  suitableLabel: string;
  id?: string;
}) {
  const detailsId = "service-details-" + service.number;

  return (
    <article id={id} className={isOpen ? "service-card is-open" : "service-card"}>
      <div className="service-topline">
        <span>{service.number}</span>
        <span>{service.price[language]}</span>
      </div>
      <div className="service-body">
        <div className="service-title-row">
          <h3>{service.title[language]}</h3>
          <button
            className="service-toggle"
            type="button"
            aria-expanded={isOpen}
            aria-controls={detailsId}
            onClick={onToggle}
            aria-label={detailsLabel + ": " + service.title[language]}
          >
            <svg viewBox="0 0 12 8" aria-hidden="true">
              <path d="M1 1.5 L6 6.5 L11 1.5" />
            </svg>
          </button>
        </div>
        <div className="service-panel" id={detailsId} hidden={!isOpen}>
          <ul className="service-prices">
            {service.rates ? (
              service.rates.map((rate) => (
                <li key={rate.amount + rate.label[language]}>
                  <b>{rate.amount}</b>
                  <span>{rate.label[language]}</span>
                </li>
              ))
            ) : (
              <li>
                <b>{service.price[language]}</b>
              </li>
            )}
          </ul>
          {service.includes.length > 0 && (
            <>
              <p className="service-kicker">{includesLabel}</p>
              <ul className="service-details">
                {service.includes.map((item) => (
                  <li key={item.text[language]}>
                    {item.text[language]}
                    {item.children && (
                      <ul>
                        {item.children.map((child) => (
                          <li key={child[language]}>{child[language]}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {service.suitable && (
            <p className="service-suitable">
              <span>{suitableLabel}</span>
              {service.suitable[language]}
            </p>
          )}
          {service.note && (
            <p className="service-note">{service.note[language]}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function ServiceSubItem({
  service,
  language,
  includesLabel,
  suitableLabel,
}: {
  service: Service;
  language: Language;
  includesLabel: string;
  suitableLabel: string;
}) {
  const priceText = service.rates
    ? service.rates.map((r) => r.amount + " " + r.label[language]).join(" · ")
    : service.price[language];
  const includesText = service.includes
    .map((item) => {
      const parts = [item.text[language]];
      if (item.children) {
        parts.push(item.children.map((child) => child[language]).join(" / "));
      }
      return parts.join(" · ");
    })
    .join(" · ");

  return (
    <li className="service-subitem">
      <div className="service-subitem-head">
        <h4>{service.title[language]}</h4>
        <span className="service-subitem-price">{priceText}</span>
      </div>
      {includesText && (
        <p className="service-subitem-includes">
          <span>{includesLabel}</span>
          {includesText}
        </p>
      )}
      {service.suitable && (
        <p className="service-subitem-suitable">
          <span>{suitableLabel}</span>
          {service.suitable[language]}
        </p>
      )}
      {service.note && <p className="service-subitem-note">{service.note[language]}</p>}
    </li>
  );
}

function upcomingOpenDays(count = 18, now = new Date()) {
  const days: string[] = [];
  const cursor = startOfDay(now);
  for (let step = 0; step < 80 && days.length < count; step += 1) {
    const iso = toISODate(cursor);
    if (isDateOpen(iso, now)) days.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// The booking "open days" list depends on the viewer's local time (timezone +
// today), which differs between the server and the browser. Render an empty list
// on the server and populate it on the client so hydration never mismatches.
let openDaysCache: string[] | null = null;

function getOpenDays(): string[] {
  if (openDaysCache === null) openDaysCache = upcomingOpenDays();
  return openDaysCache;
}

function subscribeToOpenDays(): () => void {
  return () => {};
}

function formatOpenDay(iso: string, language: Language) {
  return fromISODate(iso).toLocaleDateString(
    language === "ru" ? "ru-RU" : "en-GB",
    {
      weekday: "short",
      day: "numeric",
      month: "long",
    },
  );
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("ru");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openService, setOpenService] = useState<string | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [aboutPhotoIndex, setAboutPhotoIndex] = useState(0);
  const [certificateIndex, setCertificateIndex] = useState(0);
  const aboutSwipeStart = useRef<number | null>(null);
  const certificateSwipeStart = useRef<number | null>(null);
  const t = copy[language];
  const hasAboutPhotos = aboutPhotos.length > 1;

  const showAboutPhoto = (index: number) => {
    const count = aboutPhotos.length;
    setAboutPhotoIndex(((index % count) + count) % count);
  };

  const handleAboutPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasAboutPhotos) return;
    if ((event.target as HTMLElement).closest("button")) return;
    aboutSwipeStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAboutPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (aboutSwipeStart.current == null) return;
    const delta = event.clientX - aboutSwipeStart.current;
    aboutSwipeStart.current = null;
    if (Math.abs(delta) < 48) return;
    showAboutPhoto(aboutPhotoIndex + (delta < 0 ? 1 : -1));
  };

  const certificate = certificates[certificateIndex];
  const hasCertificates = certificates.length > 1;

  const showCertificate = (index: number) => {
    const count = certificates.length;
    if (count === 0) return;
    setCertificateIndex(((index % count) + count) % count);
  };

  const handleCertificatePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasCertificates) return;
    if ((event.target as HTMLElement).closest("button")) return;
    certificateSwipeStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCertificatePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (certificateSwipeStart.current == null) return;
    const delta = event.clientX - certificateSwipeStart.current;
    certificateSwipeStart.current = null;
    if (Math.abs(delta) < 48) return;
    showCertificate(certificateIndex + (delta < 0 ? 1 : -1));
  };

  const openDays = useSyncExternalStore(
    subscribeToOpenDays,
    getOpenDays,
    () => [],
  );
  const timeSlots = selectedDate ? availableSlots(selectedDate) : TIME_SLOTS;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const closeMenu = () => setMenuOpen(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={t.brandAria}>
          <img className="brand-logo" src="/oz-spa-logo.png" alt="" />
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>{menuOpen ? t.nav.close : t.nav.menu}</span>
          <span className="menu-lines" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
        <nav
          id="main-navigation"
          className={"main-nav " + (menuOpen ? "is-open" : "")}
          aria-label="Primary navigation"
        >
          <a href="#about" onClick={closeMenu}>
            {t.nav.about}
          </a>
          <a href="#services" onClick={closeMenu}>
            {t.nav.services}
          </a>
          <a href="#journal" onClick={closeMenu}>
            {t.nav.journal}
          </a>
          <a href="#gallery" onClick={closeMenu}>
            {t.nav.gallery}
          </a>
          <a className="nav-cta" href="#booking" onClick={closeMenu}>
            {t.nav.book} <span>↗</span>
          </a>
        </nav>
        <div className="language-switch" aria-label="Language">
          <button
            type="button"
            className={language === "ru" ? "is-active" : ""}
            onClick={() => setLanguage("ru")}
          >
            RU
          </button>
          <span>/</span>
          <button
            type="button"
            className={language === "en" ? "is-active" : ""}
            onClick={() => setLanguage("en")}
          >
            EN
          </button>
        </div>
      </header>

      <section className="hero section-pad" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line">
              <span className="eyebrow-dot" aria-hidden="true" />
              {t.hero.eyebrowRole}
            </span>
            <span className="eyebrow-line">
              <span className="eyebrow-dot" aria-hidden="true" />
              {t.hero.eyebrow}
            </span>
          </p>
          <h1>
            {t.hero.title} <em>{t.hero.titleEm}</em>
          </h1>
          <p className="hero-lead">{t.hero.lead}</p>
          <div className="hero-actions">
            <a className="button button-dark" href="#booking">
              {t.hero.choose} <span>↗</span>
            </a>
            <a className="text-link" href="#services">
              {t.hero.procedures} <span>↓</span>
            </a>
          </div>
          <div className="hero-notes">
            {t.hero.notes.map((note, index) => (
              <span key={note}>
                0{index + 1} <b>{note}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-image-wrap">
            <img
              src="/hero-hair.png"
              alt={t.hero.imageAlt}
              className="hero-image"
              fetchPriority="high"
            />
          </div>
          <div className="floating-note floating-note-top">
            <span className="note-icon">✦</span>
            <span>
              <b>{t.hero.noteTop}</b>
              <small>{t.hero.noteTopSmall}</small>
            </span>
          </div>
          <a
            className="floating-note floating-note-bottom"
            href={"#service-" + services[0].number}
            onClick={() => setOpenService(services[0].number)}
            aria-label={services[0].title[language]}
          >
            <span className="note-number">01</span>
            <span>
              <small>{t.hero.noteBottomSmall}</small>
              <b>{t.hero.noteBottom}</b>
            </span>
          </a>
        </div>
      </section>

      <div className="ticker" aria-label="Focus areas">
        <div className="ticker-track">
          {t.ticker.concat(t.ticker).map((item, index) => (
            <span key={item + index}>
              {item}
              <i>✳</i>
            </span>
          ))}
        </div>
      </div>

      <section className="about section-pad" id="about">
        <div className="section-intro">
          <p className="eyebrow">{t.about.label}</p>
        </div>

        <div
          className="about-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label={t.about.label}
          onPointerDown={handleAboutPointerDown}
          onPointerUp={handleAboutPointerUp}
          onPointerCancel={() => {
            aboutSwipeStart.current = null;
          }}
        >
          <div className="about-grid">
            <div className="about-image-wrap">
              <div className="about-photos">
                {aboutPhotos.map((photo, index) => (
                  <div
                    key={photo.src}
                    className={
                      index === aboutPhotoIndex
                        ? "about-photo is-active"
                        : "about-photo"
                    }
                    aria-hidden={index !== aboutPhotoIndex}
                  >
                    <img
                      src={photo.src}
                      alt={index === aboutPhotoIndex ? photo.alt[language] : ""}
                      className="about-image"
                      style={{ objectPosition: photo.position ?? "center" }}
                      loading={index < 2 ? "eager" : "lazy"}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
              <span className="image-caption">
                {t.about.caption.split("|").map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </span>
            </div>
            <div className="about-copy">
              <p className="about-counter" aria-hidden="true">
                <span className="about-counter-current">
                  {String(aboutPhotoIndex + 1).padStart(2, "0")}
                </span>
                <span className="about-counter-sep" aria-hidden="true">
                  /
                </span>
                <span className="about-counter-total">
                  {String(aboutPhotos.length).padStart(2, "0")}
                </span>
              </p>
              <p key={aboutPhotoIndex} className="about-slide-text">
                {t.about.slides[aboutPhotoIndex]}
              </p>
              <div className="signature">
                <span className="signature-line" />
                <span>{t.about.signature}</span>
              </div>
            </div>
          </div>

          <div className="about-controls">
            <button
              type="button"
              className="about-arrow"
              aria-label={t.about.prevSlide}
              onClick={() => showAboutPhoto(aboutPhotoIndex - 1)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div className="about-slider-dots" aria-label={t.about.slideLabel}>
              {aboutPhotos.map((photo, index) => (
                <button
                  key={photo.src}
                  type="button"
                  className={index === aboutPhotoIndex ? "is-active" : ""}
                  aria-label={`${t.about.slideLabel} ${index + 1}`}
                  aria-current={
                    index === aboutPhotoIndex ? "true" : undefined
                  }
                  onClick={() => showAboutPhoto(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className="about-arrow"
              aria-label={t.about.nextSlide}
              onClick={() => showAboutPhoto(aboutPhotoIndex + 1)}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
        <div className="certificates">
          <h3>{t.about.certificatesTitle}</h3>
          {certificate ? (
            <div
              className="about-slider certificate-slider"
              role="region"
              aria-roledescription="carousel"
              aria-label={t.about.certificatesTitle}
              onPointerDown={handleCertificatePointerDown}
              onPointerUp={handleCertificatePointerUp}
              onPointerCancel={() => {
                certificateSwipeStart.current = null;
              }}
            >
              <img
                key={certificate.src}
                src={certificate.src}
                alt={certificate.alt[language]}
                className="certificate-image"
                style={{ objectPosition: certificate.position ?? "center" }}
                loading="lazy"
                draggable={false}
              />
              {hasCertificates ? (
                <>
                  <button
                    type="button"
                    className="about-slider-btn about-slider-prev"
                    aria-label={t.about.prevCertificate}
                    onClick={() => showCertificate(certificateIndex - 1)}
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <button
                    type="button"
                    className="about-slider-btn about-slider-next"
                    aria-label={t.about.nextCertificate}
                    onClick={() => showCertificate(certificateIndex + 1)}
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                  <div className="about-slider-dots">
                    {certificates.map((item, index) => (
                      <button
                        key={item.src}
                        type="button"
                        className={index === certificateIndex ? "is-active" : ""}
                        aria-label={`${t.about.certificate} ${index + 1}`}
                        aria-current={index === certificateIndex ? "true" : undefined}
                        onClick={() => showCertificate(index)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="process-row">
          <div className="process-label">{t.about.processLabel}</div>
          {t.about.process.map((step, index) => (
            <div className="process-step" key={step[0]}>
              <span>0{index + 1}</span>
              <b>{step[0]}</b>
              <small>{step[1]}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="services section-pad section-tint" id="services">
        <div className="services-heading">
          <div className="section-intro">
            <p className="eyebrow">{t.services.label}</p>
            <h2>
              {t.services.title} <em>{t.services.titleEm}</em>
            </h2>
          </div>
          <p className="heading-aside">{t.services.aside}</p>
        </div>
        <div className="services-list">
          {featuredServices.map((service) => (
            <ServiceRow
              key={service.number}
              service={service}
              language={language}
              id={"service-" + service.number}
              isOpen={openService === service.number}
              onToggle={() =>
                setOpenService((current) =>
                  current === service.number ? null : service.number,
                )
              }
              detailsLabel={t.services.details}
              includesLabel={t.services.includes}
              suitableLabel={t.services.suitable}
            />
          ))}
          <article
            className={
              extrasOpen ? "service-card service-more is-open" : "service-card service-more"
            }
          >
            <div className="service-topline" />
            <div className="service-body">
              <div className="service-title-row">
                <h3>{t.services.more}</h3>
                <button
                  className="service-toggle"
                  type="button"
                  aria-expanded={extrasOpen}
                  aria-controls="extra-services"
                  onClick={() => setExtrasOpen((open) => !open)}
                  aria-label={t.services.more}
                >
                  <svg viewBox="0 0 12 8" aria-hidden="true">
                    <path d="M1 1.5 L6 6.5 L11 1.5" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="service-extra-list" id="extra-services" hidden={!extrasOpen}>
              <ul className="service-subitems">
                {extraServices.map((service) => (
                  <ServiceSubItem
                    key={service.number}
                    service={service}
                    language={language}
                    includesLabel={t.services.includes}
                    suitableLabel={t.services.suitable}
                  />
                ))}
              </ul>
            </div>
          </article>
        </div>
        <div className="services-footnote">
          <span>{t.services.notSure}</span>
          <a href="#booking">
            {t.services.message} <span>↗</span>
          </a>
        </div>
      </section>

      <section className="instagram-strip section-pad">
        <div className="instagram-intro">
          <div className="instagram-badge">◎</div>
          <div>
            <p className="eyebrow">{t.instagram.label}</p>
            <h2>
              {t.instagram.title} <em>{t.instagram.titleEm}</em>
            </h2>
          </div>
        </div>
        <p className="instagram-copy">{t.instagram.text}</p>
        <a
          className="button button-outline"
          href="https://www.instagram.com/olga_zhgirova"
          target="_blank"
          rel="noreferrer"
        >
          {t.instagram.open} <span>↗</span>
        </a>
      </section>

      <section className="gallery section-pad" id="gallery">
        <div className="gallery-heading">
          <div className="section-intro">
            <p className="eyebrow">{t.gallery.label}</p>
            <h2>{t.gallery.title}</h2>
          </div>
          <p>{t.gallery.text}</p>
        </div>
        <div className="gallery-grid">
          {galleryImages.map((image, index) => (
            <figure
              className={"gallery-item gallery-item-" + (index + 1)}
              key={image.src}
            >
              <img
                src={image.src}
                alt={t.gallery.alts[index]}
                className={image.className}
                loading="lazy"
              />
              <figcaption>
                {String(index + 1).padStart(2, "0")} / {t.gallery.study}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="journal section-pad section-tint" id="journal">
        <div className="journal-heading">
          <div className="section-intro">
            <p className="eyebrow">{t.journal.label}</p>
            <h2>
              {t.journal.title} <em>{t.journal.titleEm}</em>
            </h2>
          </div>
          <a className="text-link" href="#journal">
            {t.journal.all} <span>↗</span>
          </a>
        </div>
        <div className="articles-grid">
          {articles.map((article, index) => (
            <article className="article-card" key={article.title[language]}>
              <div className="article-number">0{index + 1}</div>
              <div className="article-meta">
                <span>{article.tag[language]}</span>
                <span>{article.time[language]}</span>
              </div>
              <h3>{article.title[language]}</h3>
              <p>{article.text[language]}</p>
              <a
                href="#journal"
                aria-label={t.journal.read + ": " + article.title[language]}
              >
                {t.journal.read} <span>↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="booking section-pad" id="booking">
        <div className="booking-heading">
          <p className="eyebrow eyebrow-light">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span className="eyebrow-text">{t.booking.label}</span>
          </p>
          <h2>
            {t.booking.title} <em>{t.booking.titleEm}</em>
          </h2>
          <p>{t.booking.text}</p>
          <div className="booking-details">
            <span>{t.booking.location}</span>
            <span>{t.booking.schedule}</span>
          </div>
        </div>
        <div className="booking-form-wrap">
          {submitted ? (
            <div className="form-success">
              <span className="success-mark">✓</span>
              <h3>{t.booking.successTitle}</h3>
              <p>{t.booking.successText}</p>
              <button
                className="text-link text-link-light"
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setSelectedDate("");
                }}
              >
                {t.booking.another} <span>↗</span>
              </button>
            </div>
          ) : (
            <form className="booking-form" onSubmit={handleSubmit}>
              <label>
                <span>{t.booking.name}</span>
                <input
                  type="text"
                  name="name"
                  placeholder={t.booking.namePlaceholder}
                  required
                />
              </label>
              <label>
                <span>{t.booking.contact}</span>
                <input
                  type="text"
                  name="contact"
                  placeholder={t.booking.contactPlaceholder}
                  required
                />
              </label>
              <label>
                <span>{t.booking.date}</span>
                <select
                  name="date"
                  required
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                >
                  <option value="" disabled>
                    {t.booking.pickDate}
                  </option>
                  {openDays.map((iso) => (
                    <option key={iso} value={iso}>
                      {formatOpenDay(iso, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t.booking.time}</span>
                <select
                  name="time"
                  required
                  defaultValue=""
                  key={selectedDate}
                  disabled={!selectedDate}
                >
                  <option value="" disabled>
                    {t.booking.pickTime}
                  </option>
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                <span>{t.booking.interest}</span>
                <select name="service" defaultValue="" required>
                  <option value="" disabled>
                    {t.booking.select}
                  </option>
                  {t.booking.serviceOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                <span>
                  {t.booking.message} <small>{t.booking.optional}</small>
                </span>
                <textarea
                  name="message"
                  placeholder={t.booking.messagePlaceholder}
                  rows={3}
                />
              </label>
              <button className="button button-light" type="submit">
                {t.booking.submit} <span>↗</span>
              </button>
              <p className="form-privacy">{t.booking.privacy}</p>
            </form>
          )}
        </div>
      </section>

      <footer className="site-footer section-pad">
        <a className="brand" href="#top" aria-label={t.brandAria}>
          <img className="brand-logo" src="/oz-spa-logo.png" alt="" />
        </a>
        <p>{t.footer.label}</p>
        <a
          className="footer-instagram"
          href="https://www.instagram.com/olga_zhgirova"
          target="_blank"
          rel="noreferrer"
        >
          Instagram <span>↗</span>
        </a>
        <span className="footer-note">{t.footer.copyright}</span>
      </footer>
    </main>
  );
}
