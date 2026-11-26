// Disease catalogue seed data — part 2.
// Contract types: ./diseases.types.js (see src/modules/diseases/schemas.ts).
// All URLs verified via web search; no media included (no verifiably
// royalty-free/educational assets confirmed for these entries).

import type { DiseaseRecord } from './diseases.types.js';

export const diseasesPart2: DiseaseRecord[] = [
  {
    name: 'Fowl Typhoid',
    category: 'Bacterial',
    incubation: 'About 5–14 days after infection; clinical signs may not appear for the first 5–10 days in chicks.',
    mortalityRate: 'Variable; often high (mortality reported up to ~40–80% in affected young birds) and can be higher in older birds than in pullorum disease.',
    symptoms:
      'Young chicks are weak, lethargic, stop eating, grow poorly and often have chalky-white droppings pasted around the vent; some show shrunken hocks, breathing difficulty, or swollen joints. Older birds may show pale combs, diarrhea, and sudden deaths; affected layers can be subclinical carriers. Birds that die often have an enlarged, bile-stained or pale liver and enlarged spleen and kidneys. Fowl typhoid is caused by Salmonella enterica serovar Gallinarum biovar Gallinarum — a distinct, host-adapted systemic disease related to but different from pullorum disease (biovar Pullorum) and from the many non-host-adapted "paratyphoid" Salmonella that mainly cause food-poisoning-type illness.',
    prevention:
      'The goal is eradication, so prevention is everything: source chicks and hatching eggs from flocks tested free of Salmonella Gallinarum; enforce strict biosecurity (rodent, wild-bird, fly and visitor control; clean water and feed; all-in/all-out management); clean and disinfect between flocks; and never buy birds of unknown status. Vaccination may be used in some countries under veterinary advice, but control through certified breeding stock and biosecurity is the standard. Fowl typhoid is a reportable disease in many countries — report suspected cases to the veterinary authorities.',
    treatment:
      'There is no recommended treatment. Antibiotics may mask illness and survivors often become permanent carriers that contaminate eggs, so treating infected flocks is discouraged. Standard practice is depopulation of confirmed infected flocks, thorough cleaning and disinfection, and restocking with certified disease-free chicks. Confirm diagnosis by laboratory isolation — clinical signs alone cannot distinguish fowl typhoid from other Salmonella infections.',
    supportiveTreatments:
      'Traditional practice with limited clinical evidence; not a substitute for veterinary care or confirmed-disease management: some farmers isolate sick birds and give extra vitamins or clean water, which may support individual comfort but will not clear the infection or stop carrier birds from shedding Salmonella. Because this disease is contagious and potentially reportable, any suspected outbreak should go to a veterinarian rather than relying on home remedies.',
    sources: [
      {
        title: 'Fowl Typhoid — Merck Veterinary Manual',
        url: 'https://www.merckvetmanual.com/poultry/salmonelloses-in-poultry/fowl-typhoid',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Fowl Typhoid in Poultry — Small and Backyard Poultry (University of Kentucky)',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/fowl-typhoid-in-poultry/',
        publisher: 'poultry.extension.org / University of Kentucky',
        type: 'university-extension',
      },
      {
        title: 'Fowl Typhoid and Pullorum Disease — Iowa State University CFSPh Factsheet',
        url: 'https://lib.dr.iastate.edu/cfsph_factsheets/64',
        publisher: 'Iowa State University, Center for Food Security & Public Health',
        type: 'university-extension',
      },
      {
        title: 'WOAH Terrestrial Animal Health Code — List of diseases of aves (includes fowl typhoid)',
        url: 'https://www.woah.org/fileadmin/Home/eng/Health_standards/tahc/2024/en_chapitre_oie_listed_disease.htm',
        publisher: 'WOAH (World Organisation for Animal Health)',
        type: 'government',
      },
    ],
    regionalNotes: {
      general:
        'Fowl typhoid is present in many parts of the world, especially where biosecurity is weak and breeding stock is untested; it is rare in certified commercial flocks but persists in backyard and village poultry.',
      ZM: 'Suspected cases should be reported to the Department of Veterinary Services; control relies on sourcing certified chicks and strict flock isolation.',
      ZA: 'The South African Poultry Association runs Salmonella Gallinarum/Pullorum surveillance in breeding flocks — use certified breeders and report suspected outbreaks.',
      KE: 'Common in village and smallholder flocks where breeding stock health is unknown; biosecurity and testing of hatchery eggs are the practical controls.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Infectious Coryza',
    category: 'Bacterial',
    incubation: 'Usually 24–48 hours after exposure; signs can appear within a day or two of birds contacting infected birds or contaminated material.',
    mortalityRate: 'Variable; mortality up to ~50% has been reported but ~20% is more typical, and much of the loss comes from secondary infections.',
    symptoms:
      'Sudden onset of facial swelling (especially around the eyes and wattles), thick foul-smelling discharge from the nostrils and eyes, sneezing, coughing, labored breathing and reduced activity. Birds may huddle, eat poorly, and show swollen eyelids that stick together; diarrhea and stunting can occur. Birds that recover often remain lifelong carriers and may shed the bacterium occasionally. The bacterium (Avibacterium paragallinarum, formerly Haemophilus paragallinarum) survives only a few days outside the host and dies quickly with heat and most disinfectants.',
    prevention:
      'Strong biosecurity is the core control: avoid introducing birds of unknown status (shows, swaps, live-bird sales), keep age groups separate where possible, clean and disinfect housing between flocks, and control rodents and wild birds. Vaccination with bacterins matched to the local serotypes (A, B, C) can be effective but must match field strains — consult a veterinarian. Recovered carriers are a continuing risk, so culling infected birds is recommended where feasible.',
    treatment:
      'Early antibiotic treatment (chosen by a veterinarian, ideally after testing) can reduce clinical signs, but antibiotics do not reliably clear carrier birds. Standard practice combines early treatment with improved husbandry — warm, dry, well-ventilated housing, clean water, and prompt removal of dead birds — and control of secondary infections. Because the bacterium is fragile outside the bird, thorough cleaning and disinfection of the house between flocks is very effective.',
    supportiveTreatments:
      'Traditional practice with limited clinical evidence; not a substitute for veterinary care: keeping the house warm, dry and draft-free, providing clean drinking water, and removing sick birds promptly are sound supportive measures that help birds cope while antibiotics work. Any traditional remedy should be used only as a complement to — never instead of — veterinary diagnosis and treatment.',
    sources: [
      {
        title: 'Infectious Coryza — Merck Veterinary Manual',
        url: 'https://www.merckvetmanual.com/poultry/infectious-coryza/infectious-coryza',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Infectious Coryza (IC): Frequently Asked Questions — University of Maryland Extension FS-1131',
        url: 'https://www.extension.umd.edu/resource/infectious-coryza-ic-frequently-asked-questions-faqs-fs-1131',
        publisher: 'University of Maryland Extension',
        type: 'university-extension',
      },
      {
        title: 'Infectious Coryza in Poultry — Small and Backyard Poultry (University of Kentucky)',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/infectious-coryza-in-poultry/',
        publisher: 'poultry.extension.org / University of Kentucky',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Infectious coryza is widespread in resource-limited poultry systems worldwide and is most common in older birds and mixed-age flocks; it is a particular risk in live-bird markets and backyard flocks.',
      ZM: 'Common in village and backyard flocks with multiple age groups; keep young birds away from older carriers and clean drinkers and feeders daily.',
      ZA: 'Outbreaks occur mainly in backyard and free-range flocks; biosecurity and, where the disease is endemic, serotype-matched vaccination under veterinary guidance are the practical controls.',
      KE: 'Frequently seen in smallholder flocks; strict separation of age groups and prompt removal of sick birds reduce spread.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Heat Stress / Thermal Stress in Broilers',
    category: 'Management',
    mortalityRate: 'Acute heat-stress episodes can kill birds within hours, especially heavier birds; mortality rises sharply when high temperature combines with high humidity.',
    symptoms:
      'Panting (open-mouth breathing), wings held away from the body, increased water intake, reduced feed intake, lethargy and crowding near cool spots. Birds may huddle, lose weight, develop pale or bruised breast muscle (woody breast/spaghetti meat defects), and in severe cases die suddenly of heat exhaustion. Young and fast-growing broilers are most vulnerable because they generate the most body heat.',
    prevention:
      'Provide maximum ventilation and air movement (fans, tunnel ventilation, open sides during cool periods), and evaporative cooling (foggers, pad cooling, sprinklers) when humidity allows. Always ensure abundant clean, cool water — water lines should deliver enough for peak heat hours. Reduce stocking density or feeding rate during heat waves, adjust feed timing to cooler hours, and monitor birds daily. House design matters: insulated roofs, shade, and proper litter depth all help.',
    treatment:
      'There is no drug treatment — management is the treatment. Emergency response: maximize air speed and ventilation, run cooling systems, check water supply immediately, and move or cull severely affected birds. Reduce feed offered during peak heat (fasting briefly during the hottest hours is an accepted practice because digestion generates heat). After the heat event, watch for secondary problems such as wet litter, increased ammonia and higher disease susceptibility.',
    supportiveTreatments:
      'Traditional practice with limited clinical evidence; not a substitute for veterinary care: providing shade, extra water, and moving birds to the coolest part of the house are sound supportive measures. Electrolyte or vitamin supplements are sometimes used by farmers after heat events, but evidence is mixed — focus first on ventilation, water and reducing heat load.',
    sources: [
      {
        title: 'Heat Stress Management in Broilers — UF/IFAS Extension VM019',
        url: 'https://ask.ifas.ufl.edu/publication/VM019/pdf',
        publisher: 'University of Florida IFAS Extension',
        type: 'university-extension',
      },
      {
        title: 'Summer Heat Stress Management for Delmarva Broiler Chicken Growers — University of Maryland Extension',
        url: 'https://extension.umd.edu/resource/summer-heat-stress-management-delmarva-broiler-chicken-growers',
        publisher: 'University of Maryland Extension',
        type: 'university-extension',
      },
      {
        title: 'Prepare Broiler Houses for Summer Weather — Mississippi State University Extension',
        url: 'https://extension.msstate.edu/publications/prepare-broiler-houses-for-summer-weather',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Beat the Heat: Keeping Birds Cool — UGA Poultry Tips',
        url: 'https://site.extension.uga.edu/poultrytips/2026/10/beat-the-heat-4-things-to-keep-in-mind-when-keeping-birds-cool/',
        publisher: 'University of Georgia Cooperative Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Heat stress is one of the biggest environmental threats to broiler production in hot climates, especially when high temperatures coincide with high humidity; smallholder flocks with simple housing are particularly at risk.',
      ZM: 'Hot dry-season months (roughly September–November) see regular heat-stress losses; provide shade, maximum ventilation and constant access to cool water, and avoid handling birds during midday heat.',
      ZA: 'Northern production regions face severe summer heat; tunnel ventilation, evaporative cooling and early-morning feeding are standard practices on commercial units.',
      ZW: 'October heat waves cause acute losses in poorly ventilated houses; emergency cooling (fans, sprinklers, extra water) is the priority response.',
      NA: 'Namibian broiler producers must plan for extreme midday temperatures year-round; well-designed tunnel-ventilated houses and shade are essential.',
      KE: 'Highland areas are generally mild, but lowland units near the coast or Rift Valley face humid heat — humidity makes heat stress worse than dry heat at the same temperature.',
    },
    evidence: {
      prevention: 'standard-practice',
      treatment: 'standard-practice',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Mycotoxicosis (Mycotoxin Poisoning in Feed)',
    category: 'Nutritional',
    incubation: 'Chronic mycotoxicosis develops over days to weeks of continuous low-level intake; acute poisoning can appear within days of feeding highly contaminated feed.',
    mortalityRate: 'Variable and dose-dependent; high levels cause significant morbidity and mortality, while low chronic levels cause poor growth and reduced disease resistance without obvious deaths.',
    symptoms:
      'Poor growth, reduced feed intake and feed conversion, unthriftiness, diarrhea, dehydration, and pale or yellowish livers. Aflatoxin causes liver damage and immunosuppression (birds fall sick more easily from other diseases); ochratoxin damages kidneys; fumonisins and T-2/HT-2 toxins affect gut health and immunity. Chickens are relatively more resistant to aflatoxin than ducks and turkeys, but young birds are most vulnerable. Feed may look normal — molds and toxins are often invisible.',
    prevention:
      'Prevent mold growth: buy feed ingredients from reliable sources, harvest and dry grain properly, store feed in cool, dry, rodent-proof conditions, use feed within recommended shelf life, and avoid visibly moldy or caked feed. Where feasible, test suspect feed for mycotoxins at a laboratory before use. Mycotoxins are chemically stable and survive normal feed processing, so prevention at the ingredient and storage stage is essential.',
    treatment:
      'There is no specific antidote — remove contaminated feed immediately and replace it with clean feed; provide fresh water and good husbandry while birds recover. A veterinarian or animal nutritionist can advise on supportive care and whether feed additives (binders) are appropriate. Never feed visibly moldy grain or feed to chickens; do not try to "wash off" or dilute heavily contaminated feed.',
    supportiveTreatments:
      'Traditional practice with limited clinical evidence; not a substitute for veterinary care: some farmers discard moldy feed, improve storage, or feed fresh greens — reasonable hygiene measures — but there is no proven traditional remedy that neutralizes mycotoxins already eaten. If mycotoxicosis is suspected, stop the suspect feed and seek veterinary advice.',
    sources: [
      {
        title: 'Mycotoxicoses in Poultry — Merck Veterinary Manual',
        url: 'https://www.merckvetmanual.com/poultry/mycotoxicoses-in-poultry/mycotoxicoses-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Aflatoxicosis in Poultry — Merck Veterinary Manual',
        url: 'https://www.merckvetmanual.com/poultry/mycotoxicoses-in-poultry/aflatoxicosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Aflatoxins in Poultry — Purdue Extension AS-615-W',
        url: 'https://www.extension.purdue.edu/extmedia/AS/AS-615-W.pdf',
        publisher: 'Purdue University Extension',
        type: 'university-extension',
      },
      {
        title: 'Sampling and Testing Feed for Mycotoxins — Nebraska Extension EC3069',
        url: 'https://extensionpubs.unl.edu/publication/ec3069/2023/pdf/view/ec3069-2023.pdf',
        publisher: 'University of Nebraska–Lincoln Extension',
        type: 'university-extension',
      },
      {
        title: 'On-farm Mycotoxin Control in Food and Feed Grain — FAO Training Manual',
        url: 'https://openknowledge.fao.org/server/api/core/bitstreams/583dbd74-36c5-4847-aa2b-4755b3843dab/content',
        publisher: 'Food and Agriculture Organization of the United Nations (FAO)',
        type: 'ngo',
      },
    ],
    regionalNotes: {
      general:
        'Mycotoxins are a major but often unrecognized cause of poor broiler performance wherever feed is home-mixed, stored in humid conditions, or bought from informal markets; aflatoxin risk is highest in hot, drought-stressed maize-growing regions.',
      ZM: 'Maize-based feeds in hot seasons are prone to aflatoxin contamination; store feed off the ground in dry, ventilated areas and reject caked or moldy bags.',
      ZW: 'Smallholder mash and locally bought layers/broiler feeds frequently carry fungal toxins; keep feed dry and use within a few weeks.',
      MW: 'Humid conditions and poor storage drive mycotoxin problems in poultry feeds; dry, rodent-proof storage and feed turnover are the key controls.',
      KE: 'Aflatoxin in home-mixed poultry feeds is a recurring problem around harvest seasons; test suspect grain where laboratory services exist.',
      TZ: 'Improper maize storage and prolonged rainy seasons increase mycotoxin risk; buy feed from reputable suppliers and inspect for mold before use.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Avian Encephalomyelitis (Epidemic Tremor)',
    category: 'Viral',
    incubation: 'Typically signs appear at about 7–10 days of age in vertically infected chicks; horizontal spread after contact usually takes at least ~11 days.',
    mortalityRate: 'Variable; mortality in affected young flocks can reach ~75% in severe outbreaks, though many chicks show milder signs and recover.',
    symptoms:
      'Affected chicks (usually 1–6 weeks old) first look dull, then become unsteady, sit on their hocks, tremble — especially fine rapid head and neck tremors best seen when the bird is handled or excited — and may progress to paralysis. Feed and water intake drops and survivors may later develop cataracts. In adult birds there are usually no signs except a temporary drop in egg production and hatchability in breeder and layer flocks. There is no treatment; it is caused by avian encephalomyelitis virus (a picornavirus).',
    prevention:
      'Use only day-old chicks from breeder flocks vaccinated against avian encephalomyelitis — this is the main control because infection is usually passed through the egg. Good hatchery hygiene (clean eggs, disinfected equipment) reduces spread in the hatchery. Since there is no treatment, prevention through vaccinated parent stock and clean hatching eggs is essential.',
    treatment:
      'There is no specific treatment. Provide supportive care: keep affected chicks in a safe, clean area with easy access to feed and water to prevent injury or trampling, and cull severely paralyzed birds humanely. Chicks that recover may retain some incoordination and can develop cataracts later. Outbreaks in unvaccinated flocks should be confirmed by a veterinarian so breeder flocks can be identified and vaccinated.',
    supportiveTreatments:
      'Traditional practice with limited clinical evidence; not a substitute for veterinary care: keeping sick chicks warm, dry and protected from being trampled, with soft feed and clean water within reach, is reasonable supportive care — but it does not fight the virus. There is no proven home remedy for avian encephalomyelitis; prevention by vaccinating breeders is the only effective strategy.',
    sources: [
      {
        title: 'Avian Encephalomyelitis — Merck Veterinary Manual',
        url: 'https://www.merckvetmanual.com/poultry/avian-encephalomyelitis/avian-encephalomyelitis',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Avian Encephalomyelitis — Poultry Hub Australia',
        url: 'https://www.poultryhub.org/all-about-poultry/health-management/disease/avian-encephalomyelitis',
        publisher: 'Poultry Hub Australia',
        type: 'industry',
      },
      {
        title: 'Factors Affecting Egg Production in Backyard Chicken Flocks (includes avian encephalomyelitis) — UF/IFAS PS029',
        url: 'https://ask.ifas.ufl.edu/publication/PS029/pdf',
        publisher: 'University of Florida IFAS Extension',
        type: 'university-extension',
      },
      {
        title: 'Important Poultry Diseases (includes Avian Encephalomyelitis) — UC ANR Publication 301669',
        url: 'https://www.ucanr.edu/sites/default/files/2019-04/301669.pdf',
        publisher: 'University of California Agriculture & Natural Resources',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Avian encephalomyelitis occurs worldwide and is controlled almost entirely through vaccination of breeder flocks; it mainly threatens smallholders who buy day-old chicks or eggs from unvaccinated, untested sources.',
      ZM: 'Village poultry buying unvaccinated breeding stock or fertile eggs risks AE outbreaks in chicks; ask suppliers whether parent flocks are vaccinated.',
      KE: 'Backyard and smallholder flocks are at risk when chicks come from unknown sources; AE vaccination of breeders is uncommon in village systems, so biosecurity of eggs and chicks matters.',
      UG: 'Mixed-age village flocks can suffer AE tremor outbreaks in young chicks; sourcing chicks from known vaccinated breeders is the practical prevention.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Fowl Cholera',
    category: 'Bacterial',
    incubation: 'Signs usually appear 3–7 days after exposure in acute cases; chronic forms may develop over weeks.',
    mortalityRate: 'Acute outbreaks can cause very high sudden mortality (often 50% or more of the flock) in susceptible birds; chronic and carrier forms cause lower losses.',
    symptoms:
      'Suddenly dead birds, or birds that are lethargic, off feed, have darkened (purplish) wattles and combs, and swollen head, wattles or joints. Chronic cases may show lameness, torticollis (twisted neck), swollen wattles, pneumonia-like breathing difficulty, or local abscesses. Birds can also be subclinical carriers. It is caused by Pasteurella multocida — a contagious bacterial disease of all poultry species, usually seen in birds older than about six weeks.',
    prevention:
      'Maintain rigorous biosecurity: clean water and feed, rodent and wild-bird control (rats, mice and wild birds spread the bacterium), clean housing, and isolation of new birds for at least two weeks. Promptly remove and safely dispose of dead birds — the bacterium survives for months in carcasses and soil. Vaccines (bacterins) exist and can help control outbreaks in endemic flocks under veterinary guidance, but are not routinely needed where the disease is absent.',
    treatment:
      'Antibiotics can be effective — Pasteurella multocida is susceptible to several common poultry antibiotics, but treatment must be chosen by a veterinarian and given early, because birds often die before treatment helps. Standard practice combines early antibiotic treatment with supportive care and strict hygiene. Since carrier birds can persist, control of chronic cases may require culling affected birds.',
    supportiveTreatments:
      'Traditional practice with limited clinical evidence; not a substitute for veterinary care: keeping the flock dry, clean and well-ventilated, ensuring fresh water, and removing sick and dead birds promptly helps reduce spread and stress — but antibiotics under veterinary direction are needed to treat the infection itself.',
    sources: [
      {
        title: 'Fowl Cholera — Merck Veterinary Manual',
        url: 'https://www.merckvetmanual.com/poultry/fowl-cholera/fowl-cholera',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Fowl Cholera — WOAH World Organisation for Animal Health',
        url: 'https://www.woah.org/en/disease/fowl-cholera/',
        publisher: 'WOAH (World Organisation for Animal Health)',
        type: 'government',
      },
      {
        title: 'Fowl Cholera in Poultry — Small and Backyard Poultry (University of Kentucky)',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/fowl-cholera-in-poultry/',
        publisher: 'poultry.extension.org / University of Kentucky',
        type: 'university-extension',
      },
      {
        title: 'Fowl Cholera — Cornell Partners AH',
        url: 'https://partnersah.vet.cornell.edu/content/fowl-cholera',
        publisher: 'Cornell University College of Veterinary Medicine',
        type: 'university-extension',
      },
      {
        title: 'The Public Health Importance and Management of Infectious Poultry Diseases in Smallholder Systems in Africa — PMC/MDPI Foods',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10855203/',
        publisher: 'MDPI Foods (open-access, peer-reviewed)',
        type: 'peer-reviewed',
      },
    ],
    regionalNotes: {
      general:
        'Fowl cholera is a worldwide disease of poultry, especially important in intensively managed systems with exotic breeds; it is often mild or subclinical in indigenous village chickens but can devastate improved flocks.',
      ZM: 'Outbreaks follow rodent and wild-bird incursions and contaminated water; control rodent populations and disinfect drinkers regularly.',
      ZA: 'Common in broiler and layer operations; sudden deaths warrant laboratory confirmation and early antibiotic intervention.',
      KE: 'A recognized cause of mortality in smallholder improved-breed flocks; wild birds and rodents around poultry houses are the usual source.',
      UG: 'Listed among the common poultry diseases in national veterinary guidelines; prompt carcass removal and antibiotic treatment under veterinary guidance are recommended.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
];
