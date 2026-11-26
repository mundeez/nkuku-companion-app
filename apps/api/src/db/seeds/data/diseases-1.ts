// Disease catalogue — part 1 of 3.
// Enriched veterinary reference records for the 12 core poultry diseases.
// Authoritative sources verified via web search (Merck Veterinary Manual,
// WOAH, university extension, open-access journals). Media fields are
// included only where a real, verifiable asset was found.
import type { DiseaseRecord } from './diseases.types.js';

export const diseasesPart1: DiseaseRecord[] = [
  {
    name: 'Newcastle Disease',
    category: 'Viral',
    incubation: 'Usually 3–6 days after exposure (strain- and host-dependent; roughly 2–15 days range).',
    mortalityRate: 'Highly variable. Velogenic (virulent) strains can kill up to ~100% of unvaccinated or poorly vaccinated flocks; mild strains and well-vaccinated flocks show much lower losses.',
    symptoms:
      'Sudden death can be the first sign in unvaccinated flocks. Typical signs include respiratory distress (gasping, coughing, nasal discharge), depression and huddling, greenish watery diarrhea, twisted neck or leg paralysis (torticollis), and swelling of the head and comb with hemorrhages. Egg-laying birds may show a 30–50% drop in production and poor shell quality.',
    prevention:
      'Vaccination (live lentogenic or inactivated vaccines at day-old and booster ages) plus strict biosecurity are the only effective controls; vaccines reduce clinical disease but do not prevent infection or shedding. Keep new birds quarantined, control wild birds and rodents, disinfect equipment, and avoid mixing age groups or sources. Movement of birds and eggs from infected areas should be restricted — outbreaks are notifiable in many countries.',
    treatment:
      'There is no specific antiviral treatment for Newcastle disease. Supportive care — warmth, good nutrition, clean water, and antimicrobials only under veterinary direction for confirmed secondary bacterial infections (e.g., E. coli) — is all that can be offered. In many countries, culling of infected and exposed flocks is required to contain spread.',
    supportiveTreatments:
      'Home care is limited to keeping sick birds warm, dry, and hydrated with easy access to feed and water, and isolating them from the rest of the flock. Traditional remedies (herbs, home-brewed tonics) are used in some regions but have no clinical evidence for Newcastle disease; do not delay veterinary advice or required reporting.',
    sources: [
      {
        title: 'Newcastle Disease in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/newcastle-disease-and-other-avian-paramyxovirus-infections/newcastle-disease-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Important poultry diseases (Newcastle Disease section)',
        url: 'https://www.ucanr.edu/sites/default/files/2019-04/301669.pdf',
        publisher: 'University of California Agriculture & Natural Resources',
        type: 'university-extension',
      },
      {
        title: 'Phylogenetic Analysis of Newcastle Disease Virus Isolated from Poultry in Live Bird Markets and Wild Waterfowl in Zambia',
        url: 'https://www.mdpi.com/2076-2607/12/2/354',
        publisher: 'MDPI Animals (open access)',
        type: 'peer-reviewed',
      },
      {
        title: 'Genomic Diversity and Geographic Distribution of Newcastle Disease Virus Genotypes in Africa',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11125703/',
        publisher: 'PubMed Central (open access)',
        type: 'peer-reviewed',
      },
    ],
    regionalNotes: {
      general:
        'Newcastle disease is endemic in most of Africa and is a major constraint for village and commercial poultry. Live and inactivated vaccines are widely used, but field viruses circulate continuously and can cause outbreaks in poorly vaccinated flocks.',
      ZM: 'Virulent Newcastle disease virus genotype VII.2 (sub-genotype VIIh) circulates in Lusaka and Eastern provinces, including in vaccinated commercial flocks, alongside vaccine-lineage genotype II strains. Vaccination alone has not eliminated outbreaks; biosecurity and live-bird market hygiene are critical.',
      ZA: 'Genotype VII strains circulate in South African poultry and are linked to regional transboundary spread from Asia via wild birds; sporadic outbreaks occur in both commercial and backyard flocks.',
      TZ: 'Genotype VII.2 and other virulent genotypes have been isolated from poultry in live bird markets; backyard flocks are frequently unvaccinated and experience high mortality.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: "Marek's Disease",
    category: 'Viral',
    incubation:
      'Clinical disease typically appears weeks to months after infection — often 2–7 months of age; nerve paralysis and tumors can appear later in life.',
    mortalityRate:
      'Variable and sporadic. In unvaccinated flocks losses can be high; in vaccinated flocks, breakthrough cases occur but mortality is usually limited to a small percentage of birds.',
    symptoms:
      'Enlarged peripheral nerves causing leg or wing paralysis ("range paralysis"), tumors of the liver, spleen, kidneys, ovaries/testes, muscle, skin, and eye (gray iris), and in some birds sudden death or cachexia with no obvious external signs. Birds often look healthy until late; immunosuppression increases susceptibility to other diseases.',
    prevention:
      'Vaccination of every chick at hatch (in ovo or subcutaneous at the hatchery) is the standard control and is strongly recommended — nearly all flocks are exposed. The virus spreads in feather dangle (dander), so strict litter and dust management, all-in/all-out production, and controlling wild birds help reduce exposure. No vaccine prevents infection entirely; it prevents tumors and nerve disease.',
    treatment:
      'There is no effective treatment for Marek\'s disease. Affected birds should be removed and culling is recommended since the virus is shed continuously and exposes the rest of the flock.',
    supportiveTreatments:
      'There are no home remedies with evidence for Marek\'s disease. Keep the environment clean and low-stress, ensure good nutrition, and isolate sick birds; any persistent paralysis or tumors should be confirmed by a veterinarian.',
    sources: [
      {
        title: "Marek's Disease in Poultry",
        url: 'https://www.merckvetmanual.com/poultry/neoplasms-in-poultry/marek-s-disease-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: "Vaccination of Backyard Poultry — Marek's Disease section",
        url: 'https://www.merckvetmanual.com/exotic-and-laboratory-animals/backyard-poultry/vaccination-of-backyard-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: "Marek's disease in chickens: a review with focus on immunology",
        url: 'https://link.springer.com/article/10.1186/s13567-016-0404-3',
        publisher: 'Veterinary Research (open access)',
        type: 'peer-reviewed',
      },
      {
        title: 'Management and medicine of backyard poultry',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7152007/',
        publisher: 'PubMed Central (open access)',
        type: 'peer-reviewed',
      },
    ],
    regionalNotes: {
      general:
        'Marek\'s disease virus is ubiquitous — essentially every chicken flock in the world is infected. Hatchery vaccination at day-old is standard practice in commercial broiler and layer production across Southern and East Africa; backyard flocks remain largely unvaccinated and vulnerable.',
      ZA: 'Commercial broiler hatcheries routinely vaccinate against Marek\'s disease; very virulent strains have been reported in the region and can partially overcome vaccine protection in high-challenge flocks.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Infectious Bursal Disease (Gumboro)',
    category: 'Viral',
    incubation: 'Clinical signs typically appear 2–5 days after infection; outbreaks in a flock usually develop over 3–4 days.',
    mortalityRate:
      'Usually low (<10%) with classic strains, but very virulent strains can cause mortality of 60% or more. High morbidity is typical even when deaths are few.',
    symptoms:
      'Sudden onset of listlessness, ruffled feathers, watery white diarrhea that soils the vent feathers, trembling, dehydration, and prostration in chicks roughly 3–6 weeks old. Survivors often have permanently damaged immune systems and fall prey to secondary infections and poor vaccine responses.',
    prevention:
      'Live attenuated vaccines (intermediate or intermediate-plus strains) are given once maternally derived antibodies have declined — timing is critical and ideally guided by flock antibody testing (e.g., the Deventer formula). Good brooding temperature, dry litter, and all-in/all-out management reduce early field-virus challenge so vaccination can take effect.',
    treatment:
      'There is no specific antiviral treatment. Supportive care — electrolytes, warmth, and good nutrition — helps, and antibiotics may be needed for secondary bacterial infections under veterinary guidance. Preventing dehydration is the main practical intervention during an outbreak.',
    supportiveTreatments:
      'Home care focuses on keeping birds warm, hydrated (electrolyte solutions), and eating; isolate sick chicks and improve litter dryness. Some farmers use traditional herbal or home remedies, but there is no clinical evidence they treat Gumboro; antibiotics are only useful for secondary infections and require veterinary input.',
    sources: [
      {
        title: 'Infectious Bursal Disease in Poultry (Gumboro Disease)',
        url: 'https://www.merckvetmanual.com/poultry/infectious-bursal-disease/infectious-bursal-disease-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Infectious Bursal Disease in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/infectious-bursal-disease-in-poultry/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
      {
        title: 'A field study on the significance of vaccination against infectious bursal disease virus at the optimal time point in broiler flocks',
        url: 'https://www.tandfonline.com/doi/full/10.1080/03079450701589175',
        publisher: 'Avian Pathology (peer-reviewed)',
        type: 'peer-reviewed',
      },
      {
        title: 'A Walk through Gumboro Disease',
        url: 'https://www.mdpi.com/2674-1164/1/4/20',
        publisher: 'MDPI Poultry (open access)',
        type: 'peer-reviewed',
      },
    ],
    regionalNotes: {
      general:
        'IBDV is present wherever chickens are raised; very virulent strains circulate in many regions and can defeat poorly timed vaccination programs. Maternal antibody levels vary widely between hatcheries, so vaccination age must be tailored to each flock.',
      ZM: 'IBD is endemic in Zambian broiler flocks. Maternal antibody decay is rapid (estimated half-life ~3 days in broilers), so live vaccination is typically scheduled around 14–21 days using flock antibody monitoring or the Deventer formula; vaccinating too early wastes the dose while MDA neutralizes it.',
      BW: 'Commercial layer and broiler parent stock in Botswana are routinely vaccinated against IBDV; very virulent IBDV strains have been reported in Southern Africa and warrant attention when vaccination fails.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Infectious Bronchitis (IB)',
    category: 'Viral',
    incubation: 'Generally 24–48 hours; viral excretion peaks 3–5 days after infection.',
    mortalityRate:
      'Usually low in broilers (most birds recover with care), but nephropathogenic strains can cause significant mortality, and layers suffer production losses rather than mass death.',
    symptoms:
      'Rapidly spreading respiratory signs — coughing, sneezing, nasal discharge, and rales — plus lethargy and reduced feed intake in young chicks. In laying hens, IB causes a drop in egg production with thin, rough, or wrinkled shells and poor internal egg quality; some strains damage kidneys (nephritis) or the oviduct, causing false layers.',
    prevention:
      'Live attenuated (e.g., Massachusetts-type) vaccines given at day-old and boosted at 14–21 days are standard for broilers, but many antigenic types exist and do not cross-protect — vaccine choice should match circulating strains where known. Strict biosecurity, clean housing between flocks, and avoiding stressors limit spread. Early infection in chicks can permanently damage the oviduct.',
    treatment:
      'There is no specific treatment. Most birds recover with supportive care — warmth, good nutrition, and water — and antimicrobials in drinking water only where secondary bacterial infection (e.g., E. coli) is confirmed by a veterinarian.',
    supportiveTreatments:
      'Supportive home care means keeping chicks warm (raising brooder temperature slightly), encouraging eating with soft warm mash, and ensuring clean water. Traditional remedies have no proven effect on IB virus; antibiotics should not be used routinely without veterinary guidance.',
    sources: [
      {
        title: 'Infectious Bronchitis in Chickens',
        url: 'https://www.merckvetmanual.com/poultry/infectious-bronchitis/infectious-bronchitis-in-chickens',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Infectious Bronchitis in Commercial Chickens',
        url: 'https://extension.msstate.edu/publications/infectious-bronchitis-commercial-chickens',
        publisher: 'Mississippi State University Extension',
        type: 'university-extension',
      },
      {
        title: 'Preventing Respiratory Diseases in Small Flocks — Infectious Bronchitis section',
        url: 'https://vbs.psu.edu/adl/articles-of-interest/respiratory-disease-prevention-diagnosis-and-treatment-in-small-flocks',
        publisher: 'Penn State Extension',
        type: 'university-extension',
      },
      {
        title: 'Common Poultry Diseases (IB section)',
        url: 'https://ask.ifas.ufl.edu/publication/PS044/pdf',
        publisher: 'University of Florida IFAS Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Infectious bronchitis is endemic wherever chickens are raised, with multiple antigenic types circulating simultaneously in many regions. Massachusetts-type live vaccines remain the backbone of control in commercial broilers across Southern and East Africa.',
      ZM: 'IBV is endemic in Zambian broiler flocks; Massachusetts-type live vaccines are commonly used in hatchery vaccination programs, with drinking-water or coarse-spray boosters at 14–21 days in high-challenge areas.',
      KE: 'IBV is widespread in Kenyan poultry; field reports suggest local antigenic variation can reduce protection from single-strain vaccines, so monitoring production drops and shell quality is important.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Coccidiosis',
    category: 'Parasitic',
    incubation:
      'Prepatent period (time from infection to oocyst shedding) is about 4–7 days; clinical disease typically follows within days of heavy exposure.',
    mortalityRate:
      'Variable — often low but can be high in severe outbreaks, especially with Eimeria tenella (cecal) and E. necatrix. Most losses come from dehydration, blood loss, and secondary bacterial infection.',
    symptoms:
      'Bloody or mucoid diarrhea (classic with cecal species), ruffled feathers, huddling, pale combs, loss of appetite, reduced weight gain, and sometimes vent pecking from soiled feathers. Lesions vary by Eimeria species: ballooning and hemorrhage in the ceca (E. tenella), ballooning of the small intestine (E. necatrix), and white pinpoint plaques in the upper intestine (E. acervulina).',
    prevention:
      'Control relies on dry, clean litter; avoid wet spots under drinkers; change litter between flocks; and limit stocking density. Coccidiostats in feed or water, live coccidiosis vaccines, and good sanitation reduce exposure. Oocysts are extremely resistant to disinfectants and persist in soil and litter for long periods.',
    treatment:
      'Amprolium (e.g., Corid/Amprol) in drinking water is the standard treatment, with sulfonamides or other approved anticoccidials used under veterinary guidance. Treatment should start promptly at first signs; repeat dosing may be needed. Never use sulfa drugs in laying hens producing eggs for consumption.',
    supportiveTreatments:
      'Supportive care — clean dry bedding, warmth, and hydration — helps birds through an outbreak. Some farmers add traditional remedies (e.g., crushed garlic, herbal preparations) to water or feed; these have limited or no clinical evidence for coccidiosis and should not replace anticoccidial treatment.',
    sources: [
      {
        title: 'Coccidiosis in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/coccidiosis-in-poultry/coccidiosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Coccidiosis in Backyard Poultry Flocks',
        url: 'https://solutions.tennessee.edu/?view_pub_pdf=76',
        publisher: 'University of Tennessee Extension',
        type: 'university-extension',
      },
      {
        title: 'Use of Anticoccidial Medications and Vaccines in Poultry Production',
        url: 'https://poultry.extension.org/articles/feeds-and-feeding-of-poultry/feed-additives-for-poultry/use-of-anticoccidial-medications-and-vaccines-in-poultry-production/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
      {
        title: 'Causes and Control of Selected Diseases Related to Backyard Chicken Flocks in Utah',
        url: 'https://extension.usu.edu/poultry/research/causes-and-control-of-sected-diseases-related-to-backyard-chicken-flocks-in-utah',
        publisher: 'Utah State University Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Coccidia are present in virtually every poultry environment; disease erupts when wet litter, high stocking density, or immunosuppression (e.g., after Gumboro) allow massive oocyst ingestion. Warm, humid climates — typical of much of Southern and East Africa — favor rapid oocyst sporulation and year-round risk.',
      ZM: 'Coccidiosis is a year-round problem in Zambian broiler flocks, with outbreaks often following heavy rains or litter wetting. Amprolium and ionophore coccidiostats are commonly used in water and feed respectively.',
      KE: 'Coccidiosis is among the top diseases of Kenyan smallholder flocks; management of litter moisture and timely amprolium treatment are the main practical controls.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Necrotic Enteritis',
    category: 'Bacterial',
    incubation: 'Peracute course of 3–4 days per bird; flock-level incidence can rise and fall over two or more weeks.',
    mortalityRate: 'Rapidly fatal — mortality can reach ~50% of affected birds, often with few preceding signs.',
    symptoms:
      'Sudden flock-level mortality spike in broilers typically 2–5 weeks old, preceded by brief depression, reluctance to move, diarrhea, and ruffled feathers. Postmortem shows gas-distended small intestine with foul-smelling contents, fibrin, and sloughed mucosa. Often follows or coincides with coccidiosis outbreaks.',
    prevention:
      'Control coccidiosis aggressively — Eimeria damage to the gut lining is the main predisposing factor. Maintain dry, quality litter; avoid mycotoxin-contaminated feed; manage diet transitions carefully; and use anticoccidial programs and, where permitted, targeted antimicrobials. C. perfringens spores are extremely hardy, so cleaning alone is insufficient.',
    treatment:
      'Water-soluble antimicrobials active against gram-positive anaerobes (e.g., penicillin/amoxicillin, bacitracin, lincomycin, or virginiamycin) are the standard treatment, typically for 5–7 days, plus continued coccidiosis control. Treatment must be directed by a veterinarian; antibiotic choice and withdrawal periods vary by country.',
    supportiveTreatments:
      'Early isolation of sick pens, dry bedding, and good nutrition support recovery, but do not substitute for antimicrobial and coccidiosis control. Probiotic or fermented-feed practices are sometimes tried as traditional gut-health measures, but evidence for treating established necrotic enteritis is limited.',
    sources: [
      {
        title: 'Necrotic Enteritis in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/necrotic-enteritis/necrotic-enteritis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Avian Necrotic Enteritis',
        url: 'https://extension.psu.edu/avian-necrotic-enteritis/',
        publisher: 'Penn State Extension',
        type: 'university-extension',
      },
      {
        title: 'Necrotic Enteritis in Broiler Chickens: A Review on the Pathogen, Pathogenesis, and Prevention',
        url: 'https://www.mdpi.com/2076-2607/10/10/1958',
        publisher: 'MDPI Animals (open access)',
        type: 'peer-reviewed',
      },
      {
        title: 'Necrotic and Ulcerative Enteritis in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/necrotic-and-ulcerative-enteritis-in-poultry/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Necrotic enteritis is linked to coccidiosis and to withdrawal of antibiotic growth promoters; it is an emerging problem wherever intensive broiler production relies on coccidiosis vaccines or ionophore-free programs. Any sudden mortality spike in 2–5 week-old broilers should trigger necropsy.',
      ZA: 'Cases are recognized in South African broiler flocks where coccidiosis control is intense; gut-integrity management and water medication are the main interventions.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Infectious Laryngotracheitis (ILT)',
    category: 'Viral',
    incubation: 'About 4–12 days from exposure to clinical signs (typically 1–2 weeks in field cases).',
    mortalityRate:
      'Variable — mild strains cause little loss, while severe outbreaks can kill a substantial fraction of the flock; recovered birds often remain lifelong carriers.',
    symptoms:
      'Severe respiratory distress: gasping, coughing up bloody mucoid exudate, rattling breathing, neck extension during inspiration, and swollen conjunctivitis. Birds may die from airway obstruction; layers show reduced egg production. Lesions include hemorrhagic tracheal exudate and necrotic plugs in the trachea/larynx.',
    prevention:
      'Live attenuated (CEO/TCO) or vectored vaccines are used in endemic areas and flocks with history of disease; vaccination of all birds matters because carriers shed virus during stress. Strict biosecurity — quarantine, clean equipment, controlled traffic, and carcass incineration — is essential since recovered and vaccinated birds remain carriers.',
    treatment:
      'There is no specific treatment. Supportive care (warmth, good air quality, nutrition) helps, and antibiotics only for confirmed secondary infections under veterinary guidance. In severe outbreaks, reducing stress and improving ventilation are the main practical measures.',
    supportiveTreatments:
      'Keep affected birds warm, in clean air, and hydrated; reduce handling and stress. Traditional remedies have no proven benefit for ILT. Because ILT is often confused with other respiratory diseases, laboratory confirmation (PCR/histology) is important before assuming a diagnosis.',
    videoUrl: 'https://www.youtube.com/embed/vFn8UjWIcfY',
    videoProvider: 'youtube',
    sources: [
      {
        title: 'Infectious Laryngotracheitis',
        url: 'https://www.merckvetmanual.com/poultry/infectious-laryngotracheitis/infectious-laryngotracheitis',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Infectious Laryngotracheitis (ILT) in Poultry',
        url: 'https://extension.psu.edu/infectious-laryngotracheitis-ilt-in-poultry/',
        publisher: 'Penn State Extension',
        type: 'university-extension',
      },
      {
        title: 'Laryngotracheitis in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/laryngotracheitis-in-poultry/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
      {
        title: 'Infectious Laryngotracheitis Infections in Small Poultry Flocks',
        url: 'https://www.uoguelph.ca/ahl/ahl-labnote-58-infectious-laryngotracheitis-ilt-infections-small-poultry-flocks',
        publisher: 'University of Guelph Animal Health Laboratory',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'ILT is present wherever dense poultry production occurs. Because recovered and live-vaccinated birds shed virus for life, outbreaks recur on farms with imperfect biosecurity; vaccination timing and coverage must be managed carefully.',
      KE: 'ILT is recognized in Kenyan layer and broiler flocks; respiratory disease outbreaks there are often multifactorial (ILT + mycoplasma + E. coli), so diagnosis should be confirmed before vaccination decisions.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Avian Influenza',
    category: 'Viral',
    incubation:
      'Flock-level incubation is about 14 days per WOAH guidance; individual birds may show signs within roughly 2–17 days of exposure.',
    mortalityRate:
      'Low-pathogenicity strains cause mild or no signs; high-pathogenicity strains (HPAI) typically kill near 100% of infected poultry, often suddenly.',
    symptoms:
      'HPAI causes sudden, widespread death with edema of the head/comb, cyanosis, nasal and oral discharge, diarrhea, and neurological signs; H5/H7 low-pathogenicity strains may show only mild respiratory signs or reduced egg production. Any unexplained high mortality with respiratory signs in poultry is a suspicion of avian influenza.',
    prevention:
      'Avian influenza — especially HPAI — is a NOTIFIABLE disease. Immediately report suspected cases to national veterinary authorities (e.g., Zambia Department of Veterinary & Livestock Services, Botswana DVS, or your national animal health service). Control relies on WOAH-recommended biosecurity: strict farm isolation, controlled movement of people/vehicles/eggs, wild-bird exclusion, and culling of infected and exposed flocks under official direction. Vaccination may be used in some countries but must be combined with surveillance and official oversight.',
    treatment:
      'There is no specific treatment for avian influenza, and treatment is generally prohibited or pointless for HPAI — infected birds are culled under official control measures. Supportive care and biosecurity are the only options; never attempt to treat or sell birds suspected of HPAI.',
    supportiveTreatments:
      'There are no home or traditional treatments for avian influenza. The only correct action is to isolate the flock, stop all bird/egg movement, and report to veterinary authorities immediately — unofficial treatment risks spreading a notifiable disease.',
    sources: [
      {
        title: 'Avian Influenza in Poultry and Wild Birds',
        url: 'https://www.merckvetmanual.com/poultry/avian-influenza-in-poultry-and-wild-birds/avian-influenza-in-poultry-and-wild-birds',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Avian Influenza — WOAH disease profile',
        url: 'https://www.woah.org/en/disease/avian-influenza/',
        publisher: 'WOAH (World Organisation for Animal Health)',
        type: 'government',
      },
      {
        title: 'Infection with High Pathogenicity Avian Influenza Viruses — WOAH Terrestrial Animal Health Code Chapter 10.4',
        url: 'https://www.woah.org/fileadmin/Home/eng/Health_standards/tahc/current/chapitre_avian_influenza_viruses.pdf',
        publisher: 'WOAH (World Organisation for Animal Health)',
        type: 'government',
      },
    ],
    regionalNotes: {
      general:
        'Avian influenza is notifiable to WOAH member countries. HPAI H5Nx strains have caused major panzootics since 2021 affecting poultry worldwide, including outbreaks reported to WOAH in Africa. Migratory waterfowl are the main reservoir; backyard flocks with poor biosecurity are at highest risk.',
      ZA: 'South Africa has reported HPAI outbreaks (including H5N8) to WOAH since 2017; affected premises are placed under official movement control and depopulated flocks are compensated under national programs.',
      ZM: 'Zambia reports avian influenza to WOAH/WAHIS; any suspected HPAI case must be reported to the Department of Veterinary & Livestock Services before any treatment or disposal decision.',
      BW: 'Botswana has reported HPAI detections in wild and domestic birds; national veterinary services coordinate outbreak response, and movement of poultry products is restricted during outbreaks.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Salmonellosis',
    category: 'Bacterial',
    incubation:
      'Variable — typically a few days to 1–2 weeks after exposure, depending on serotype and bird age.',
    mortalityRate:
      'Pullorum disease can kill up to ~100% of infected chicks in the first weeks; fowl typhoid mortality is high in young birds and significant in older birds; paratyphoid salmonellae usually cause milder or subclinical infection.',
    symptoms:
      'In chicks: huddling near heat, weakness, anorexia, white pasty feces on the vent, respiratory signs, swollen joints, or blindness. Older birds may be pale, dehydrated, and have diarrhea; fowl typhoid causes a swollen, friable, bile-stained liver. Many carrier birds show no signs — especially with paratyphoid serotypes, which are a food-safety concern.',
    prevention:
      'Use only hatching eggs and chicks from tested Salmonella-free flocks; fumigate or disinfect eggs; maintain strict hatchery hygiene. For pullorum/fowl typhoid, the goal is complete eradication — testing and culling of positive breeder flocks — because survivors become carriers. Control wild birds, rodents, and contaminated feed/water; practice good litter and equipment hygiene.',
    treatment:
      'Antimicrobials may reduce mortality temporarily but do NOT eliminate infection — treated birds often remain carriers, so treatment is generally not recommended for pullorum/fowl typhoid. For paratyphoid infections, antibiotics may be used under veterinary guidance but will not clear carrier status. Prevention and flock testing are the real solutions.',
    supportiveTreatments:
      'Home remedies cannot clear Salmonella infection. Keep sick birds isolated, warm, and hydrated; ensure feed and water are clean. Because Salmonella is a zoonosis and food-safety risk, handle sick birds and eggs hygienically and consult a veterinarian — especially before consuming eggs from affected flocks.',
    sources: [
      {
        title: 'Pullorum Disease in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/salmonelloses-in-poultry/pullorum-disease-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Overview of Salmonelloses in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/salmonelloses-in-poultry/overview-of-salmonelloses-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Fowl Typhoid and Pullorum Disease',
        url: 'https://lib.dr.iastate.edu/cfsph_factsheets/64',
        publisher: 'Iowa State University Center for Food Security & Public Health',
        type: 'university-extension',
      },
      {
        title: 'Understanding Salmonella; Its Presence and Control in Live Poultry (FS-1137)',
        url: 'https://www.extension.umd.edu/resource/understanding-salmonella-its-presence-and-control-live-poultry-fs-1137',
        publisher: 'University of Maryland Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Salmonella is common in poultry worldwide. Pullorum disease and fowl typhoid persist mainly in backyard and non-certified flocks, while paratyphoid serotypes (e.g., S. Enteritidis, S. Typhimurium) are a persistent food-safety and public-health issue linked to eggs and meat.',
      ZM: 'Pullorum disease and fowl typhoid are recognized in Zambian poultry, particularly in untested backyard breeding flocks; paratyphoid Salmonella on eggs is a food-safety concern for household consumption.',
      KE: 'Salmonella paratyphoid serotypes are frequently isolated from Kenyan poultry products; flock testing and egg hygiene are the key control measures for both animal and human health.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'E. coli Infection (Colibacillosis)',
    category: 'Bacterial',
    incubation:
      'Variable — signs can appear within days of exposure or develop gradually as a secondary infection.',
    mortalityRate:
      'Highly variable — from low losses in localized infections (cellulitis, airsacculitis) to near-total losses in acute septicemia, especially in young chicks.',
    symptoms:
      'Depends on the form: sudden death and generalized illness in septicemia; swollen head and facial swelling (swollen head syndrome); abdominal swelling and peritonitis/salpingitis in layers; unabsorbed yolk sac (omphalitis) in chicks; respiratory rales from airsacculitis; lameness from osteomyelitis; or swollen combs/wattles from cellulitis. Diarrhea, lethargy, and reduced feed intake are common.',
    prevention:
      'E. coli is normal gut flora — disease occurs when birds are stressed or immunosuppressed. Prevent by controlling respiratory viruses (IB, ND, mycoplasma), coccidiosis, and Gumboro; maintaining good air quality, litter dryness, and temperature; disinfecting hatchery equipment and eggs; and sourcing clean day-old chicks. Vaccines exist for breeders/layers in some markets.',
    treatment:
      'Water-soluble antibiotics chosen by culture and sensitivity testing are the standard — many field strains are multi-drug resistant, so treatment without testing often fails. Supportive care (warmth, hydration) matters; severely affected birds are usually culled. Always observe antibiotic withdrawal periods before consuming eggs or meat.',
    supportiveTreatments:
      'Home care includes isolating sick birds, keeping them warm, and ensuring clean water and feed — but herbal or home remedies have no proven effect on colibacillosis. Because E. coli strains differ widely in antibiotic resistance, treatment should follow laboratory testing rather than guesswork.',
    sources: [
      {
        title: 'Colibacillosis in Poultry (Colisepticemia)',
        url: 'https://www.merckvetmanual.com/poultry/colibacillosis/colibacillosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Colibacillosis in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/colibacillosis-in-poultry/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
      {
        title: 'Diseases of small poultry flocks — E. coli section',
        url: 'https://extension.umn.edu/agriculture/animals-and-livestock/poultry/diseases-of-small-poultry-flocks',
        publisher: 'University of Minnesota Extension',
        type: 'university-extension',
      },
      {
        title: 'Colibacillosis',
        url: 'https://www.poultryhub.org/all-about-poultry/health-management/disease/colibacillosis',
        publisher: 'Poultry Hub Australia',
        type: 'industry',
      },
    ],
    regionalNotes: {
      general:
        'Colibacillosis is one of the most common bacterial diseases of poultry and is usually secondary to viral respiratory disease, mycoplasmosis, or coccidiosis. Poor ventilation, ammonia, and dusty conditions strongly predispose flocks.',
      ZM: 'E. coli is frequently isolated from Zambian broiler and layer flocks, often alongside mycoplasma and viral respiratory infections; antibiotic resistance is common, so culture-guided treatment is essential.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Chronic Respiratory Disease (CRD) / Mycoplasma',
    category: 'Bacterial',
    incubation:
      'Slow and insidious — clinical signs often develop over weeks after introduction of infected stock; incubation can be several weeks.',
    mortalityRate:
      'Usually low directly, but morbidity is high; losses come from poor production and secondary E. coli/viral infections that raise mortality substantially.',
    symptoms:
      'Slow-onset respiratory signs — rales, coughing, nasal discharge, swollen infraorbital sinuses ("infraorbital sinusitis"), and conjunctivitis — with gradual drops in feed intake, weight gain, and egg production. Turkeys show more severe signs than chickens; many flocks show only subclinical infection with production losses.',
    prevention:
      'Source day-old chicks and breeders certified free of Mycoplasma gallisepticum; maintain closed flocks and strict biosecurity since the organism spreads by aerosols, contaminated equipment, and egg transmission. In high-challenge areas, vaccination can reduce clinical signs and egg losses but does not eliminate infection.',
    treatment:
      'Antimicrobials (e.g., tylosin, tetracyclines, fluoroquinolones — as legally available and directed by a veterinarian) can reduce clinical signs and egg transmission but do NOT eliminate infection. Treatment is typically reserved for valuable flocks; eradication via depopulation and restocking with clean stock is the definitive control.',
    supportiveTreatments:
      'Traditional remedies have no proven effect against mycoplasma. Reduce stress, improve ventilation and litter quality, and ensure good nutrition to help birds cope; long-term control requires testing, culling positive birds, and restocking with certified clean stock.',
    sources: [
      {
        title: 'Mycoplasma gallisepticum Infection in Poultry (Chronic Respiratory Disease)',
        url: 'https://www.merckvetmanual.com/poultry/mycoplasmosis/mycoplasma-gallisepticum-infection-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Overview of Mycoplasmosis in Poultry',
        url: 'https://www.merckvetmanual.com/poultry/mycoplasmosis/overview-of-mycoplasmosis-in-poultry',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Recognizing and Preventing Mycoplasma gallisepticum (MG) Infection in Poultry',
        url: 'https://www.extension.umd.edu/resource/recognizing-and-preventing-mycoplasma-gallisepticum-mg-infection-poultry',
        publisher: 'University of Maryland Extension',
        type: 'university-extension',
      },
      {
        title: 'Mycoplasmas in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/mycoplasmas-in-poultry/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'M. gallisepticum is endemic in poultry worldwide and is a leading cause of chronic respiratory disease and production losses. It acts synergistically with E. coli and respiratory viruses, and is frequently transmitted through infected breeding stock and eggs.',
      ZA: 'Mycoplasma gallisepticum is widespread in South African layer and breeder flocks; testing and maintenance of MG-free parent stock is standard in integrated operations.',
      KE: 'CRD/mycoplasmosis is common in Kenyan commercial and backyard flocks; respiratory outbreaks there are usually polymicrobial, requiring both mycoplasma and secondary-infection management.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
  {
    name: 'Fowl Pox',
    category: 'Viral',
    incubation:
      'About 4–10 days from exposure to appearance of scabs/lesions, depending on route of infection.',
    mortalityRate:
      'Usually low — dry pox mortality is roughly 1–5%; the wet (diphtheritic) form can cause much higher losses when lesions obstruct the airway or GI tract.',
    symptoms:
      'Two forms: dry pox shows raised, wart-like scab lesions on unfeathered skin (comb, wattles, eyelids, legs, vent) that heal in ~2 weeks; wet pox shows canker-like lesions in the mouth, pharynx, larynx, and trachea causing respiratory distress and sometimes suffocation. Affected birds show ruffled feathers, lethargy, slower growth, and temporary drops in egg production.',
    prevention:
      'Vaccination (wing-web or eye-drop at 6–8 weeks, or as recommended locally) protects flocks in endemic areas. Mosquito control is critical since mosquitoes are the main vectors — eliminate standing water and use nets/screens. Biosecurity against contaminated scabs, equipment, and introduced birds also reduces spread. Recovered birds are generally immune for life.',
    treatment:
      'There is no specific antiviral treatment. Supportive care — soft food for birds with mouth lesions, warm dry housing, and keeping wounds clean — helps; secondary bacterial infections may need antibiotics under veterinary guidance. Most birds recover in 2–4 weeks.',
    supportiveTreatments:
      'Traditional practice of applying emollients or herbal pastes to scabs is common but has no clinical evidence; keeping lesions clean and birds well-fed is the main support. Remove scabs gently only if they impede feeding, and isolate affected birds.',
    sources: [
      {
        title: 'Fowlpox in Chickens and Turkeys',
        url: 'https://www.merckvetmanual.com/poultry/fowlpox/fowlpox-in-chickens-and-turkeys',
        publisher: 'Merck Veterinary Manual',
        type: 'industry',
      },
      {
        title: 'Fowl Pox in Poultry',
        url: 'https://poultry.extension.org/articles/poultry-health/common-poultry-diseases/fowl-pox-in-poultry/',
        publisher: 'Poultry Extension (University of Kentucky)',
        type: 'university-extension',
      },
      {
        title: 'Recognizing and Preventing Avian Pox in Small Flocks (FS-979)',
        url: 'https://www.extension.umd.edu/resources/animal-agriculture/poultry/disease-management',
        publisher: 'University of Maryland Extension',
        type: 'university-extension',
      },
      {
        title: 'D193 Fowl Pox in Backyard Poultry Flocks',
        url: 'https://solutions.tennessee.edu/?view_pub_pdf=75',
        publisher: 'University of Tennessee Extension',
        type: 'university-extension',
      },
    ],
    regionalNotes: {
      general:
        'Fowl pox is present wherever chickens and turkeys are raised; mosquito-borne transmission makes wet-season outbreaks common in tropical and subtropical regions. The wet form can be confused with other respiratory diseases — scabs on unfeathered skin are the distinguishing sign.',
      ZM: 'Fowl pox occurs in Zambian village and commercial flocks, with mosquito transmission peaking in the rainy season; wing-web vaccination is used where the disease is endemic.',
      KE: 'Avian pox is recognized in Kenyan backyard and commercial flocks; wet-form outbreaks causing respiratory distress are reported during periods of high mosquito activity.',
    },
    evidence: {
      prevention: 'veterinary-recommended',
      treatment: 'veterinary-recommended',
      supportiveTreatments: 'traditional-limited-evidence',
    },
  },
];
