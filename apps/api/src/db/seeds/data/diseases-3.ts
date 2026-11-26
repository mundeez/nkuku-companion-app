// Disease seed data — part 3 (14 conditions).
// Contract: see diseases.types.ts. All source URLs were verified via web search.
// Media fields intentionally omitted: no verifiably royalty-free imagery or
// educational embeds were confirmed for these conditions.

import type { DiseaseRecord } from './diseases.types.js';

export const diseasesPart3: DiseaseRecord[] = [
  {
    name: 'Avian Tuberculosis (Mycobacterium avium)',
    category: 'Bacterial',
    incubation: 'Weeks to months — a slow, chronic disease',
    mortalityRate: 'Variable; affected birds usually die eventually, losses are gradual',
    symptoms:
      'Birds become progressively weak and emaciated — ribs may show through the skin and birds feel much lighter than healthy ones. They lose weight despite eating, may have pale combs, diarrhoea, and sometimes swollen joints or a "pigeon-breasted" breastbone. Death usually follows a long wasting course rather than sudden illness.',
    prevention:
      'There is no effective vaccine or practical treatment, so prevention is everything. Source stock from flocks tested free of avian TB, keep feeders and drinkers clean, and prevent wild birds and rodents from entering the poultry house. Do not put new birds on premises where TB has occurred — the bacteria survive for months in soil, litter and droppings.',
    treatment:
      'There is no effective treatment for poultry and infected birds should be culled humanely. Antibiotics that work in humans require months of daily dosing and do not cure the bird, so treatment is not recommended. A veterinarian can confirm the diagnosis by examining a dead bird (granulomas, acid-fast bacteria in tissues).',
    supportiveTreatments:
      'No home remedy can cure avian TB — it is a chronic bacterial infection requiring laboratory confirmation and culling. Good general care (clean water, balanced feed, dry litter) helps keep the rest of the flock healthy while infected birds are identified and removed. Always involve a veterinarian before trying any treatment.',
    sources: [
      {
        title: 'Tuberculosis in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/tuberculosis-in-poultry/tuberculosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Avian tuberculosis — WOAH Disease Card',
        url: 'https://www.woah.org/en/disease/avian-tuberculosis/',
        publisher: 'WOAH (World Organisation for Animal Health)',
        type: 'government',
      },
      {
        title: 'Avian Tuberculosis — WOAH Terrestrial Animal Health Code chapter',
        url: 'https://www.woah.org/fileadmin/Home/eng/Health_standards/tahm/3.03.06_AVIAN_TB.pdf',
        publisher: 'WOAH (World Organisation for Animal Health)',
        type: 'government',
      },
      {
        title: 'Tuberculosis in Birds: Insights into the Mycobacterium avium Infections',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3135220/',
        publisher: 'Veterinary Medicine International (open access)',
        type: 'peer-reviewed',
      },
    ],
    regionalNotes: {
      general:
        'Avian TB is uncommon in well-managed commercial flocks but occurs more often in small, long-lived backyard and free-range flocks where birds live for months or years and pick up the bacteria from contaminated soil, water or droppings. Because birds look healthy until late in the disease, affected birds are often not noticed until several have died.',
      ZM: 'In Zambia, where many households keep free-range chickens that scavenge and live for years, avian TB can go unnoticed as a gradual wasting disease. Testing suspect birds through a veterinary laboratory is important before assuming deaths are from other causes.',
      BW: 'Botswana’s village flocks are long-lived and often free-ranging, conditions under which avian TB can establish slowly. Because the disease is untreatable, culling visibly wasted birds and keeping new stock off contaminated ground are the practical controls.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Aspergillosis (Brooder Pneumonia)',
    category: 'Fungal',
    incubation: 'Hours to days after heavy inhalation of fungal spores',
    mortalityRate: 'Can be high in young flocks; often 30–90% in severe outbreaks',
    symptoms:
      'Young chicks (usually under 3 weeks old) gasp, open-mouth breathe and may appear weak or lethargic. Mortality can be sudden, and survivors often remain stunted with poor growth. In older birds, chronic respiratory signs, poor feed conversion and unthriftiness are typical.',
    prevention:
      'The fungus comes from contaminated environment, not from bird to bird. Clean and disinfect incubators, hatchers, feeders and waterers before each batch; never use mouldy litter or shavings; keep litter dry; and remove birds from mouldy buildings. Newly bought chicks should come from hatcheries with good hygiene records.',
    treatment:
      'There is no effective treatment once birds are infected — antifungal drugs have had little success in poultry. The practical response is to cull severely affected chicks, thoroughly clean and disinfect the house, dry out all bedding, and start a fresh batch on clean litter. A vet can confirm by post-mortem examination.',
    supportiveTreatments:
      'Supportive care can only ease suffering: provide fresh clean water, keep chicks warm and dry, and reduce dust in the air. There is no proven home remedy that eliminates the fungus from a bird\'s lungs — prevention through hygiene is the only reliable control. Consult a veterinarian for diagnosis.',
    sources: [
      {
        title: 'Aspergillosis in Poultry (Brooder Pneumonia)',
        url: 'https://www.merckvetmanual.com/poultry/aspergillosis/aspergillosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Common Infectious Diseases in Backyard Poultry — Aspergillosis',
        url: 'https://www.merckvetmanual.com/exotic-and-laboratory-animals/backyard-poultry/common-infectious-diseases-in-backyard-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Aspergillosis — Cornell Wildlife Health Lab',
        url: 'https://cwhl.vet.cornell.edu/resource/aspergillosis',
        publisher: 'Cornell Wildlife Health Lab, Cornell University',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Aspergillosis is a management disease — it explodes when mouldy litter, damp shavings or a contaminated hatchery meets young birds. Wet-season brooding and reused, damp bedding are the classic triggers. Good ventilation, dry litter and clean hatching equipment prevent almost all outbreaks.',
      ZM: 'Zambia\'s warm, humid conditions make damp litter and mould growth a constant risk, especially in the rainy season. Smallholders who reuse old bedding or brood chicks in damp houses should be especially vigilant for sudden chick deaths with gasping.',
      KE: 'In Kenya\'s highland brooding houses, condensation and cool damp conditions favour mould growth in litter. Disinfecting between batches and airing houses well before placing new chicks are the key preventive steps.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Botulism (Clostridium botulinum Toxemia)',
    category: 'Bacterial',
    incubation: 'Hours to ~2 weeks after eating contaminated feed or carcasses',
    mortalityRate: 'Very high if untreated; most affected birds die within days',
    symptoms:
      'Affected birds develop a progressive flaccid (limp) paralysis — wings droop, necks go limp ("limberneck"), legs weaken and birds cannot stand or hold their heads up. Birds often die from paralysis of the breathing muscles rather than from visible illness. Birds may appear bright and alert right up to death.',
    prevention:
      'Botulism is a toxemia, not a contagious disease — birds get it by eating toxin produced by Clostridium botulinum in decaying matter. Keep carcasses, spoiled feed, and rotting vegetation out of the birds\' reach; provide fresh clean water; avoid feeding decomposing kitchen scraps; and clean drinkers and feeders regularly. Vaccination exists for high-risk flocks.',
    treatment:
      'There is no specific antidote for poultry. Remove the contaminated feed or source immediately, give fresh water, and keep affected birds warm and quiet. Antitoxin or antibiotics are sometimes used under veterinary supervision with mixed success. Most birds either recover within days if exposure stops or die — cull birds that remain severely paralysed.',
    supportiveTreatments:
      'Care is supportive only: remove the toxin source, provide fresh clean water and easy access to feed, keep birds warm and protected from predators, and move affected birds to a quiet pen. No herbal or home remedy neutralises botulinum toxin — if birds are paralysed, contact a veterinarian promptly.',
    sources: [
      {
        title: 'Botulism in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/botulism/botulism-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Botulism in Animals',
        url: 'https://www.merckvetmanual.com/infectious-diseases/clostridial-diseases/botulism-in-animals',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Botulism — Cornell Wildlife Health Lab',
        url: 'https://cwhl.vet.cornell.edu/resource/botulism',
        publisher: 'Cornell Wildlife Health Lab, Cornell University',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Outbreaks almost always follow birds scavenging on rotting carcasses, maggot-infested material or spoiled feed — common wherever scavenging is allowed near dumps, abattoirs or other dead birds. Because it is not contagious, removing the toxic source is the main control.',
      ZM: 'Free-range and scavenging flocks in Zambia may pick up toxin from rotting carcasses or contaminated water, especially where flocks mix with wild birds. Keeping dead birds and abattoir waste away from poultry ranges is the practical prevention.',
      BW: 'Village chickens in Botswana often scavenge near human settlements and water points; any rotting organic matter can harbour the bacteria. Prompt removal of carcasses and clean drinking water greatly reduce risk.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Fatty Liver Hemorrhagic Syndrome (FLHS)',
    category: 'Nutritional',
    incubation: 'Develops over weeks to months of over-conditioning in high-producing birds',
    mortalityRate: 'Low flock-wide; sudden death of individual birds when the liver ruptures',
    symptoms:
      'Birds appear outwardly healthy right up to death — often found dead suddenly with no warning signs. This is typical of layers and breeders more than fast-growing broilers, but can occur in any over-conditioned bird. On post-mortem the liver is pale, greasy and brittle with blood clots.',
    prevention:
      'FLHS is caused by birds taking in more energy than they can use — rich feed plus little exercise. Feed a balanced complete ration rather than extra grain or kitchen scraps, avoid overfeeding, and encourage activity. In hot climates, reducing feed energy slightly and ensuring good ventilation helps.',
    treatment:
      'There is no treatment once the liver is damaged — affected birds die suddenly when the fragile liver bleeds. The control is nutritional: rebalance the diet to correct the energy–protein ratio, and some veterinarians recommend selenium or vitamin E supplementation. Work with a nutritionist or vet to reformulate feed.',
    supportiveTreatments:
      'There is no home remedy for FLHS — it is a metabolic condition, not an infection. General flock care (fresh water, dry litter, good ventilation, correct feed) supports overall health but cannot repair a fatty, bleeding liver. Consult a veterinarian or feed supplier about diet balancing.',
    sources: [
      {
        title: 'Metabolic Diseases and Condition — Small and Backyard Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/metabolic-diseases-and-condition/',
        publisher: 'University of Kentucky / poultry.extension.org',
        type: 'university-extension',
      },
      {
        title: 'Diseases of Small Poultry Flocks — Fatty Liver Syndrome',
        url: 'https://extension.umn.edu/agriculture/animals-and-livestock/poultry/diseases-of-small-poultry-flocks',
        publisher: 'University of Minnesota Extension',
        type: 'university-extension',
      },
      {
        title: 'Feeds and Nutrition — Fatty Liver Hemorrhagic Syndrome',
        url: 'https://extension.msstate.edu/agriculture/livestock/poultry/feeds-and-nutrition',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Fatty Liver – Hemorrhagic Syndrome in a Chicken',
        url: 'https://tvmdl.tamu.edu/case-studies/fatty-liver-hemorrhagic-syndrome-in-a-chicken/',
        publisher: 'Texas A&M Veterinary Medical Diagnostic Laboratory',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'FLHS is primarily a layer and breeder problem — birds that eat a rich diet but move little accumulate fat in the liver until it bleeds. In broiler flocks it is less common but can occur in slow-growing or over-conditioned birds kept on rich feed without exercise.',
      ZM: 'In Zambia\'s many smallholder layer flocks fed kitchen scraps or extra grain on top of complete feed, FLHS can appear as unexplained sudden deaths in otherwise healthy-looking hens. Balancing the diet and avoiding overfeeding are the practical controls.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Ascites / Pulmonary Hypertension Syndrome (PHS)',
    category: 'Management',
    incubation: 'Develops over the grow-out period, usually after 4–5 weeks of age',
    mortalityRate: 'Usually 1–5% of the flock; can exceed 10% in severe outbreaks',
    symptoms:
      'Affected broilers become cyanotic (bluish) with swollen abdomens from fluid buildup, and may show laboured breathing. Mortality rises sharply after about 5 weeks of age; birds that die suddenly may have had no obvious illness beforehand. Flies gather around dead birds because the abdomen is fluid-filled.',
    prevention:
      'Ascites is driven by oxygen demand exceeding the heart\'s ability to pump blood through the lungs — it is a management disease. Slow growth with feed restriction, lower-energy diets, restricted lighting hours, good ventilation and avoiding cold stress in the first 3 weeks all reduce incidence. At high altitude the risk is much higher, so special management is needed.',
    treatment:
      'There is no treatment once right-sided heart failure develops — birds die from fluid accumulation around the heart and lungs. Control is entirely preventive: reduce growth rate, improve air quality, keep birds warm in cold weather, and avoid high-salt feeds or water. A vet can confirm by post-mortem showing fluid around the heart and congested lungs/liver.',
    supportiveTreatments:
      'No home treatment reverses ascites — it is a heart and lung failure, not an infection. Keeping affected birds cool, calm and well-ventilated may briefly ease breathing, but the condition is progressive. Prevention through growth management, ventilation and temperature control is the only real control.',
    sources: [
      {
        title: 'Ascites Syndrome in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/miscellaneous-conditions-of-poultry/ascites-syndrome-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Causes of Ascites in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/causes-of-ascites-in-poultry/',
        publisher: 'University of Kentucky / poultry.extension.org',
        type: 'university-extension',
      },
      {
        title: 'Managing broiler production challenges at high altitude',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9297789/',
        publisher: 'Journal of Animal Science and Biotechnology (open access)',
        type: 'peer-reviewed',
      },
      {
        title: 'Ross Broiler Management — Brooding Hints (Air Quality)',
        url: 'https://www.ross.africa/wp-content/uploads/2026/07/Ross-Booklet-May-2026.pdf',
        publisher: 'Aviagen / Ross Africa',
        type: 'industry',
      },
    ],
    regionalNotes: {
      general:
        'Ascites is mainly a problem for fast-growing commercial broilers, especially at high altitude where thin air means less oxygen. In lowland areas it is triggered by cold stress, poor ventilation, rapid growth and high-salt diets. Slowing growth and improving air quality are the practical controls.',
      ET: 'Ethiopia\'s highland broiler farms (Addis Ababa and surrounding areas sit above 2,000 m) face chronic hypoxia-driven ascites. Hatchery and feed companies there recommend slower-growing strains, feed restriction and careful brooding for highland flocks.',
      LS: 'Lesotho is one of the highest-altitude countries in Africa; broiler flocks there need special management — restricted feeding, good ventilation and attention to cold stress during brooding — to keep ascites losses down.',
      ZM: 'Zambia\'s plateau broilers are generally at moderate altitude, so ascites is less altitude-driven but still occurs with cold stress, poor ventilation and very fast growth rates. Good brooding temperature and air quality are the key controls.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Tibial Dyschondroplasia (Leg Abnormality)',
    category: 'Nutritional',
    incubation: 'Develops during rapid growth, typically visible at 14–25 days of age',
    mortalityRate: 'Low directly; causes lameness, poor welfare and some culling',
    symptoms:
      'Affected birds are reluctant to move and walk with a swaying, stiff or painful gait. The hock may look swollen or the bird may sit more than usual. Severe cases show a bent or bowed leg and birds may be unable to reach feed and water.',
    prevention:
      'TD is linked to extremely fast growth, mineral imbalance (especially excess chloride or phosphorus relative to calcium) and sometimes mycotoxin-contaminated feed. Feed a properly balanced ration from a reputable mill, avoid over-fast growth where possible, and check feed for mould. Good genetics and avoiding copper deficiency also help.',
    treatment:
      'There is no treatment for TD — the abnormal cartilage in the leg bone does not correct itself. Birds with severe lameness should be culled humanely because they cannot compete for feed and suffer chronic pain. Prevention through nutrition and growth management is the only effective approach.',
    supportiveTreatments:
      'Supportive care is limited to keeping affected birds comfortable — easy access to feed and water at ground level, dry non-slip litter, and protection from being trampled. No supplement or herbal remedy repairs the cartilage defect. Work with a vet or nutritionist to correct dietary mineral balance.',
    sources: [
      {
        title: 'Mineral Deficiencies in Poultry — Tibial Dyschondroplasia',
        url: 'https://www.merckvetmanual.com/poultry/nutrition-and-management-poultry/mineral-deficiencies-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Noninfectious Skeletal Disorders in Poultry — Dyschondroplasia',
        url: 'https://www.merckvetmanual.com/poultry/disorders-of-the-skeletal-system-in-poultry/noninfectious-skeletal-disorders-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Leg Health in Chickens (FS-1179)',
        url: 'https://www.extension.umd.edu/resource/leg-health-chickens-fs-1179',
        publisher: 'University of Maryland Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'TD is essentially a disease of very fast-growing broiler strains — the skeleton cannot keep up with muscle growth. It is worsened by cheap or poorly balanced feed, especially feed high in phosphorus or salt relative to calcium. Using quality complete feed and avoiding over-fast growth are the main controls.',
      ZM: 'Zambian broiler farmers using high-energy commercial rations with very fast-growing strains should watch for lameness around 2–4 weeks. Ensuring feed comes from reputable mills with correct mineral balance prevents most cases.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Omphalitis / Yolk Sac Infection (Mushy Chick Disease)',
    category: 'Bacterial',
    incubation: 'Within the first few days of life, usually before the navel heals',
    mortalityRate: 'High in affected chicks; most die within the first week',
    symptoms:
      'Affected chicks look swollen around the abdomen, have a soft unhealed or red/infected navel, and often appear weak or "mushy" — unable to stand or stay upright. Some have large unabsorbed yolk sacs, and the abdomen may smell foul. Chicks often die within days of hatching.',
    prevention:
      'Omphalitis is caused by bacteria (E. coli, Staphylococcus and others) entering through an unhealed navel or contaminated eggs. Prevention is all about hatchery hygiene: clean and disinfect eggs before setting, keep hatchers and chick boxes clean, maintain correct temperature and humidity so navels heal, and do not overcrowd newly hatched chicks.',
    treatment:
      'There is no specific treatment — affected chicks almost always die within days, so culling is the practical response. Unaffected chicks in the same batch should be watched closely; antibiotics can be used under veterinary guidance if mortality is spreading, but prevention through hatchery hygiene is far more effective.',
    supportiveTreatments:
      'Home care cannot cure omphalitis — it is a bacterial infection of the navel and yolk sac. Keeping the hatch environment clean, dry and at correct temperature helps unaffected chicks heal their navels; providing fresh water and starter feed supports survivors. Severe cases should be culled to protect the rest of the batch.',
    sources: [
      {
        title: 'Common Poultry Diseases — Omphalitis',
        url: 'https://ask.ifas.ufl.edu/publication/PS044/pdf',
        publisher: 'UF/IFAS Extension, University of Florida',
        type: 'university-extension',
      },
      {
        title: 'Avian Digestive System — Omphalitis',
        url: 'https://www2.ca.uky.edu/agcomm/pubs/ASC/ASC203/ASC203.pdf',
        publisher: 'University of Kentucky Cooperative Extension',
        type: 'university-extension',
      },
      {
        title: 'Diseases of Poultry — Bacterial Diseases (Colibacillosis/Omphalitis)',
        url: 'https://extension.msstate.edu/agriculture/livestock/poultry/diseases-poultry',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Colibacillosis in Poultry — University of Kentucky',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/colibacillosis-in-poultry/',
        publisher: 'University of Kentucky / poultry.extension.org',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Omphalitis is a hatchery disease — it strikes in the first days of life when navels fail to heal, usually because eggs or hatchery equipment were dirty, or temperature and humidity were wrong. Clean hatching practice prevents almost all cases.',
      ZM: 'In Zambia, many chicks come from small-scale or informal hatcheries where egg cleaning and brooder temperature control may be inconsistent. Farmers should check navel healing in the first week and reject batches with high early deaths.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Footpad Dermatitis / Pododermatitis (Bumblefoot Lesions)',
    category: 'Management',
    incubation: 'Develops over days to weeks of exposure to wet, irritating litter',
    mortalityRate: 'Low directly; secondary infection can cause lameness and some deaths',
    symptoms:
      'The skin on the bottom of the feet becomes thickened, inflamed, then develops black scabs, ulcers or sores. Birds with severe lesions limp, sit more, and may be reluctant to walk to feed and water. In heavy birds the sores can become infected and form abscesses (bumblefoot).',
    prevention:
      'Footpad dermatitis is caused by wet, caked or ammonia-irritated litter — it is a management disease. Keep litter dry with good ventilation, fix leaking drinkers, maintain correct drinker height so birds do not waste water into the litter, and use good-quality dry bedding. Reducing ammonia and humidity is critical.',
    treatment:
      'Treatment depends on severity. Mild cases improve when litter is dried out and kept clean. Severe ulcerated or infected feet need veterinary care — cleaning, antibiotics, and sometimes surgical drainage of abscesses. Birds that cannot walk should be culled humanely.',
    supportiveTreatments:
      'The main home measure is environmental: replace wet litter, fix leaks, improve ventilation, and move affected birds to a dry clean pen with soft bedding. Cleaning sores gently with warm water and keeping feet dry helps mild cases. Do not apply kerosene, engine oil or other chemicals to feet — these damage tissue and delay healing.',
    sources: [
      {
        title: 'Footpad Dermatitis in Poultry: A Common Issue in Commercial and Backyard Flocks (APSC-191)',
        url: 'https://aaec.vt.edu/content/dam/pubs_ext_vt_edu/APSC/apsc-191/APSC-191.pdf',
        publisher: 'Virginia Tech Cooperative Extension',
        type: 'university-extension',
      },
      {
        title: 'Why Broiler Growers Should Be Concerned about Paw Quality',
        url: 'https://extension.msstate.edu/publications/why-broiler-growers-should-be-concerned-about-paw-quality',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Good Litter Management Improves Broiler Performance, Health, and Welfare',
        url: 'https://extension.msstate.edu/publications/good-litter-management-improves-broiler-performance-health-and-welfare',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Reducing Footpad Dermatitis in Broilers — Impact Brief',
        url: 'https://www.caes.uga.edu/research/impact/impact-brief/3205/reducing-footpad-dermatitis-in-broilers.html',
        publisher: 'University of Georgia',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Footpad dermatitis is almost entirely a litter-management problem — wet litter plus ammonia burns the footpads. It is common wherever ventilation is poor or drinkers leak, and is worse in heavy fast-growing birds. Dry litter management prevents most cases.',
      ZM: 'In Zambia\'s humid climate, keeping litter dry is harder — especially in the rainy season. Smallholders using sawdust or wood shavings should check drinker lines for leaks and add fresh dry bedding regularly to prevent footpad sores.',
      ZA: 'South Africa\'s large commercial broiler industry actively monitors footpad dermatitis because it affects both welfare and processing condemnations. The same litter-management principles apply to smallholder flocks.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Ammonia Toxicity / Poor Air Quality',
    category: 'Management',
    incubation: 'Develops over days of exposure to accumulated ammonia in poorly ventilated houses',
    mortalityRate: 'Indirect — increases disease susceptibility and mortality, especially near market age',
    symptoms:
      'Birds exposed to high ammonia show eye irritation, coughing, sneezing, and increased susceptibility to respiratory disease such as airsacculitis. They may have reduced feed intake, poor growth, and higher mortality late in the grow-out period. Humans entering the house notice a sharp ammonia smell and eye irritation.',
    prevention:
      'Ammonia comes from decomposing droppings in wet litter — prevention is moisture and ventilation management. Keep litter dry, maintain good ventilation especially at night, remove wet caked litter between flocks, and monitor ammonia levels. Ammonia should stay below about 20–25 ppm for bird health.',
    treatment:
      'There is no treatment for ammonia damage once it has occurred — the damage is to the respiratory tract lining. Immediate action is to increase ventilation, remove wet litter, and lower ammonia levels in the house. Affected birds recover slowly if the air clears, but respiratory damage may be permanent.',
    supportiveTreatments:
      'The only "treatment" is fixing the environment: increase airflow, remove wet litter, fix leaks, and keep birds dry. Giving affected birds clean air and reducing stocking density helps them recover. No medication reverses ammonia damage — prevention through ventilation and litter management is essential.',
    sources: [
      {
        title: 'Chapter 7 — Air Quality (University of Kentucky Poultry)',
        url: 'https://afs.mgcafe.uky.edu/poultry/chapter-7-air-quality',
        publisher: 'University of Kentucky',
        type: 'university-extension',
      },
      {
        title: 'Minimum Ventilation Can Challenge Broilers',
        url: 'https://extension.msstate.edu/publications/minimum-ventilation-can-challenge-broilers',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Spring and Fall Broiler Production — Monitor Ammonia and Humidity',
        url: 'https://accessibility.extension.msstate.edu/sites/default/files/publications/p2780_web.pdf',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Aviagen AA Broiler Pocket Guide — Air Quality',
        url: 'https://aviagen.com/assets/Tech_Center/AA_Broiler/Aviagen-AA-Broiler-PocketGuide-EN.pdf',
        publisher: 'Aviagen',
        type: 'industry',
      },
    ],
    regionalNotes: {
      general:
        'Ammonia toxicity is a ventilation and litter problem, not a disease — it builds up when droppings decompose in damp litter and the house is not ventilated enough. It is especially dangerous at night when ventilation is reduced, and in small poorly ventilated houses.',
      ZM: 'In Zambia\'s small-scale broiler houses, inadequate ventilation and wet litter during the rainy season can let ammonia reach harmful levels. Farmers should check air quality at night, not just during the day, and add dry litter regularly.',
      ET: 'Ethiopia\'s highland broiler farms often have tightly closed houses to conserve heat — this traps ammonia. Ventilation must be balanced with heat retention, and litter moisture must be actively managed.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Avian Leukosis (Avian Leukosis Virus / ALV)',
    category: 'Viral',
    incubation: 'Months — disease typically appears in birds over 16 weeks old',
    mortalityRate: 'Typically 1–2% of birds; can exceed 20% in severe outbreaks',
    symptoms:
      'Affected birds develop internal tumours — enlarged liver, spleen, kidneys or bursa of Fabricius — causing weight loss, pale combs, weakness and sometimes paralysis or lameness if nerves are affected. Many birds show no obvious signs until post-mortem reveals the tumours. Subclinical infection can reduce egg production and growth.',
    prevention:
      'ALV is a retrovirus spread vertically (from parent to chick through the egg) and horizontally through infected dander and faeces. The most effective control is using breeding stock from ALV-free flocks — most commercial breeding companies have eradicated it from their primary lines. Strict biosecurity and not mixing with untested birds helps.',
    treatment:
      'There is no treatment and no vaccine for avian leukosis. Infected birds should be culled humanely. The practical control is prevention — purchasing chicks from ALV-free hatcheries and maintaining biosecurity to prevent introduction.',
    supportiveTreatments:
      'No home treatment can eliminate ALV — it is a viral cancer-causing disease. General flock health measures (clean water, balanced feed, good hygiene) support overall health but cannot prevent or cure leukosis. The only real control is buying from tested ALV-free breeding stock.',
    sources: [
      {
        title: 'Avian Leukosis in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/neoplasms-in-poultry/avian-leukosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Overview of Neoplasms in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/neoplasms-in-poultry/overview-of-neoplasms-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Chapter 4 — Leukosis (University of Kentucky Poultry)',
        url: 'https://afs.mgcafe.uky.edu/poultry/chapter-4-leukosis',
        publisher: 'University of Kentucky',
        type: 'university-extension',
      },
      {
        title: 'Lymphoid Leukosis — Poultry Hub Australia',
        url: 'https://www.poultryhub.org/all-about-poultry/health-management/disease/lymphoid-leukosis',
        publisher: 'Poultry Hub Australia',
        type: 'industry',
      },
    ],
    regionalNotes: {
      general:
        'ALV is mainly a problem in older birds and breeding flocks — commercial broiler chickens are usually slaughtered before tumors appear. It is more common in long-lived backyard flocks and in flocks from untested breeding stock. Buying from reputable ALV-free hatcheries is the key prevention.',
      ZM: 'In Zambia, backyard chickens that live for years are at higher risk of ALV than fast-growing commercial broilers. Buying chicks from tested commercial hatcheries rather than untested local sources reduces risk.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Reovirus Infection / Malabsorption Syndrome',
    category: 'Viral',
    incubation: 'Variable — malabsorption typically seen at 3–6 weeks of age',
    mortalityRate: 'Low for malabsorption syndrome; moderate in severe tenosynovitis outbreaks',
    symptoms:
      'Two main forms: malabsorption syndrome causes stunted growth, poor feathering, pale birds, undigested feed in droppings, and orange-tinged diarrhoea; viral arthritis causes swollen hock joints, lameness and sometimes ruptured tendons. Birds look unthrifty and growth is stunted even if feed intake seems normal.',
    prevention:
      'Reovirus is widespread and most strains are harmless, but pathogenic strains cause disease. Prevention relies on good biosecurity — clean disinfection between flocks, controlling rodent and wild bird access, and vaccination of breeder flocks to give chicks maternal immunity. Avoid stress and overcrowding.',
    treatment:
      'There is no specific treatment for reovirus — it is a viral infection. Affected birds should be supported with good nutrition, clean water, and reduced stress. Secondary bacterial infections may need antibiotics under veterinary guidance. In severe cases, culling unthrifty birds may be necessary.',
    supportiveTreatments:
      'Supportive care focuses on nutrition and reducing stress: provide highly digestible feed, fresh clean water, and good litter to support immune function. No herbal remedy treats the virus itself. Ensure secondary bacterial infections are addressed by a veterinarian if they develop.',
    sources: [
      {
        title: 'Avian Reovirus — Cornell Wildlife Health Lab',
        url: 'https://cwhl.vet.cornell.edu/resource/avian-reovirus',
        publisher: 'Cornell Wildlife Health Lab, Cornell University',
        type: 'university-extension',
      },
      {
        title: 'Multicausal Enteric Disease of Poultry — Malabsorption Syndrome',
        url: 'https://www.msdvetmanual.com/poultry/multicausal-enteric-disease/multicausal-enteric-disease-of-poultry',
        publisher: 'MSD Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Avian Advice Fa2003 — Avian Reovirus Infections',
        url: 'https://poultry-science.uark.edu/_resources/pdf/avian_advice_Fa2003.pdf',
        publisher: 'University of Arkansas Cooperative Extension',
        type: 'university-extension',
      },
      {
        title: 'REO Virus Infections in Broiler Breeders — Canadian Poultry Council',
        url: 'https://canadianpoultry.ca/wp-content/uploads/2026/02/reo_virus.pdf',
        publisher: 'Canadian Poultry Council',
        type: 'industry',
      },
    ],
    regionalNotes: {
      general:
        'Reovirus is extremely common in poultry worldwide — most flocks carry harmless strains, but pathogenic strains cause malabsorption or leg problems. It spreads by faecal-oral contact and from hen to chick through the egg, so breeder flock health and biosecurity are key.',
      ZM: 'In Zambia\'s broiler flocks, malabsorption syndrome appears as flocks of stunted, pale birds with poor growth around 3–6 weeks. Ensuring chicks come from healthy breeder flocks and maintaining good biosecurity reduces impact.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Staphylococcosis (Staphylococcus aureus Infection)',
    category: 'Bacterial',
    incubation: 'Variable — depends on entry point and immune status of the bird',
    mortalityRate: 'Variable; high in systemic disease or bacterial chondronecrosis outbreaks',
    symptoms:
      'Staphylococcus causes different problems depending on where it enters — joint infections cause swollen, painful hocks and lameness; foot infections cause bumblefoot; navel infections kill chicks; and systemic infection causes sudden death with no clear signs. Birds may be lethargic, off-feed, or show localized swelling at the infection site.',
    prevention:
      'Staphylococcus is everywhere in the environment — prevention is about keeping skin and mucous membranes intact. Keep litter dry, fix sharp objects that cause foot injuries, prevent overcrowding and fighting, maintain good biosecurity, and ensure chicks have clean navels at hatch. Healthy birds resist infection better.',
    treatment:
      'Treatment depends on the form — localized infections need cleaning and possibly antibiotics; systemic infection needs injectable antibiotics under veterinary care. Antimicrobial choice should be guided by culture and sensitivity testing. Severely affected birds with abscesses or chronic lameness should be culled.',
    supportiveTreatments:
      'Supportive care includes keeping affected birds isolated, providing clean dry bedding, ensuring good nutrition and hydration, and reducing stress. For localized skin infections, gentle cleaning with warm water may help. Do not use random antibiotics without veterinary guidance — resistance is a serious risk.',
    sources: [
      {
        title: 'Staphylococcosis in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/staphylococcosis/staphylococcosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Diseases of Small Poultry Flocks — Staphylococcus aureus Infection',
        url: 'https://extension.umn.edu/agriculture/animals-and-livestock/poultry/diseases-of-small-poultry-flocks',
        publisher: 'University of Minnesota Extension',
        type: 'university-extension',
      },
      {
        title: 'Review on Skeletal Disorders Caused by Staphylococcus spp. in Poultry',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8843168/',
        publisher: 'The Veterinary Quarterly (open access)',
        type: 'peer-reviewed',
      },
    ],
    regionalNotes: {
      general:
        'Staphylococcosis is an opportunistic infection — it strikes when skin is broken by injuries, wet litter, or fighting. It is common in both backyard and commercial flocks, especially where litter is wet or birds are overcrowded. Good husbandry and dry conditions are the main prevention.',
      ZM: 'In Zambia, staphylococcal infections appear as lameness from infected joints, bumblefoot on wet litter, or sudden deaths in stressed birds. Keeping litter dry and reducing injuries are the practical controls for smallholder flocks.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Inclusion Body Hepatitis (IBH — Fowl Adenovirus)',
    category: 'Viral',
    incubation: 'Usually 3–5 weeks of age in broilers',
    mortalityRate: 'Can cause sudden mortality of 10–30% in affected flocks',
    symptoms:
      'Affected broilers show sudden increased mortality with few warning signs — birds may just be found dead. Some show pallor, lethargy, or swollen abdomens. Internal examination reveals a pale, swollen liver with blood spots and sometimes fluid around the heart. It can be confused with other diseases.',
    prevention:
      'IBH is caused by fowl adenovirus and spreads through contaminated faeces, dander, and equipment — plus vertically through eggs. Prevention relies on strict biosecurity, clean disinfection between flocks, controlling wild birds and rodents, and vaccination where available. Good hatchery hygiene prevents vertical transmission.',
    treatment:
      'There is no treatment for IBH — it is a viral disease. Supportive care (clean water, good nutrition, reduced stress) may help surviving birds, but the main response is prevention. Secondary bacterial infections may need antibiotics under veterinary guidance.',
    supportiveTreatments:
      'Supportive care focuses on reducing stress and supporting immune function: clean water, balanced feed, good litter, and low stocking density. No home remedy treats the adenovirus itself. Vaccination and biosecurity are the only effective controls.',
    sources: [
      {
        title: 'Inclusion Body Hepatitis and Hepatitis Hydropericardium Syndrome in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/inclusion-body-hepatitis-and-hepatitis-hydropericardium-syndrome/inclusion-body-hepatitis-and-hepatitis-hydropericardium-syndrome-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Epidemiology, Pathology, Prevention, and Control of IBH and HHS in Poultry',
        url: 'https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2022.963199/full',
        publisher: 'Frontiers in Veterinary Science (open access)',
        type: 'peer-reviewed',
      },
      {
        title: 'Fowl Adenovirus Hepatitis (IBH and HHS): An Emerging Poultry Disease',
        url: 'https://journals.flvc.org/edis/article/view/134852',
        publisher: 'UF/IFAS Extension, University of Florida',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'IBH mainly affects fast-growing broilers around 3–5 weeks — sudden mortality spikes are the hallmark. It spreads rapidly through contaminated equipment and faeces, so biosecurity between flocks and clean hatchery practice are essential. Vaccination helps where available.',
      ZM: 'In Zambia\'s commercial broiler sector, IBH appears as sudden unexplained mortality in flocks around 3–4 weeks. Farmers should ensure strict cleaning between batches and buy chicks from reputable sources.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Infectious Synovitis (Mycoplasma synoviae)',
    category: 'Bacterial',
    incubation: 'Variable — often 4–16 weeks, but can be earlier',
    mortalityRate: 'Low–moderate; mainly causes lameness and reduced performance',
    symptoms:
      'Two forms: joint infection causes lameness, swollen hock joints, stilted gait, breast blisters and weight loss; respiratory form causes sneezing, coughing and air sac inflammation. Birds may be pale, lethargic, and show reduced growth. Chronic infection can persist for the life of the bird.',
    prevention:
      'Mycoplasma synoviae spreads vertically through eggs from infected breeders and horizontally through direct contact and airborne particles. Prevention requires buying from MS-free breeding stock, maintaining biosecurity, and eradicating infected flocks. The National Poultry Improvement Plan monitors for MS in commercial flocks.',
    treatment:
      'Antibiotics (tylosin, erythromycin, spectinomycin, lincomycin, tetracyclines) can reduce symptoms but do not eliminate the organism — birds usually remain carriers. Treatment is most effective by injection. Eradication of infected flocks is the only sure control.',
    supportiveTreatments:
      'Antibiotics under veterinary guidance are the main treatment — they reduce symptoms but do not cure. Supportive care includes good nutrition, clean water, and reducing stress. Because MS is often a carrier state, long-term flock health depends on prevention and eradication rather than treatment.',
    sources: [
      {
        title: 'Mycoplasmas in Poultry — Mycoplasma synoviae',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/mycoplasmas-in-poultry/',
        publisher: 'University of Kentucky / poultry.extension.org',
        type: 'university-extension',
      },
      {
        title: 'Common Poultry Diseases — Infectious Synovitis',
        url: 'https://ask.ifas.ufl.edu/publication/PS044/pdf',
        publisher: 'UF/IFAS Extension, University of Florida',
        type: 'university-extension',
      },
      {
        title: 'Mycoplasma synoviae — Fact Sheet',
        url: 'https://waddl.vetmed.wsu.edu/2022/11/10/mycoplasma-synoviae-fact-sheet/',
        publisher: 'Washington State University Veterinary Diagnostic Lab',
        type: 'university-extension',
      },
      {
        title: 'Avian Advice Fa2000 — Mycoplasma synoviae',
        url: 'https://poultry-science.uark.edu/_resources/pdf/avian_advice_Fa2000.pdf',
        publisher: 'University of Arkansas Cooperative Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Infectious synovitis is common in multi-age backyard flocks and is often mixed with other respiratory diseases. It spreads slowly but persistently — once a flock is infected, most birds become carriers. Buying from MS-free sources and maintaining biosecurity are the only reliable controls.',
      ZM: 'In Zambia\'s backyard flocks, MS appears as lameness and swollen joints in older birds, often alongside respiratory signs. Because it is a carrier disease, replacing the whole flock with tested stock is more effective than treating individual birds.',
      TZ: 'Tanzania\'s village poultry systems often mix ages and species, creating ideal conditions for MS spread. Introducing only tested birds and avoiding contact with neighbouring flocks reduces risk.',
      UG: 'Uganda\'s free-range and semi-intensive flocks can carry MS subclinically — birds look healthy but pass it to offspring. Testing breeding stock before hatching is the practical prevention.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
];
