import { PrismaClient } from '@prisma/client';

export async function seedDiseases(prisma: PrismaClient) {
  console.log('[SEED] Diseases...');

  const diseases = [
    {
      name: 'Newcastle Disease',
      category: 'Viral',
      incubation: '2-14 days',
      mortalityRate: '50-90% (velogenic strains)',
      symptoms: 'Conjunctivitis, respiratory signs, neurological signs (torticollis), greenish diarrhea, sudden death',
      prevention: 'Vaccination (live lentogenic or recombinant vaccines), biosecurity, quarantine',
      treatment: 'No specific treatment; supportive care with vitamins and electrolytes',
      organicTreatments: 'Basil leaf and ginger concoction, clove extract, aloe vera gel in drinking water',
    },
    {
      name: 'Marek\'s Disease',
      category: 'Viral',
      incubation: '3-6 weeks',
      mortalityRate: 'Variable, depends on strain',
      symptoms: 'Paralysis of legs and wings, tumors in internal organs, weight loss, depression',
      prevention: 'Vaccination at hatchery (in-ovo or day-old), HVT, Rispens, or SB1 vaccines',
      treatment: 'No treatment available',
      organicTreatments: 'Ginger and turmeric combination in feed, bitter leaf extract',
    },
    {
      name: 'Infectious Bursal Disease (Gumboro)',
      category: 'Viral',
      incubation: '2-3 weeks',
      mortalityRate: '5-50% (up to 50% with virulent strains)',
      symptoms: 'Depression, ruffled feathers, diarrhea, swollen bursa, immunosuppression',
      prevention: 'Live vaccines (mild or intermediate strains), recombinant HVT-vector vaccines',
      treatment: 'No specific treatment; supportive care',
      organicTreatments: 'Neem leaves extract, turmeric in water',
    },
    {
      name: 'Coccidiosis',
      category: 'Parasitic',
      incubation: '4-7 days',
      mortalityRate: 'Up to 40%',
      symptoms: 'Weight loss, bloody droppings, ruffled feathers, huddling, reduced feed intake',
      prevention: 'Live oocyst vaccines, coccidiostats in feed, medication programs',
      treatment: 'Amprolium, coccidiostats, sulfa drugs',
      organicTreatments: 'Turmeric and black pepper (weekly), neem leaves, ginger in water',
    },
    {
      name: 'Infectious Laryngotracheitis (ILT)',
      category: 'Viral',
      incubation: '4-12 days',
      mortalityRate: 'Variable',
      symptoms: 'Bloody mucus expectoration, gasping, ruffled feathers, nasal discharge',
      prevention: 'Live conventional or recombinant vaccines',
      treatment: 'Emergency vaccination in early stages, antibiotics for secondary infections',
      organicTreatments: 'Honey and garlic mixture, eucalyptus oil vapor',
    },
    {
      name: 'Avian Influenza',
      category: 'Viral',
      incubation: '1-3 days (HPAI)',
      mortalityRate: '50-90% (HPAI), 5-30% (LPAI)',
      symptoms: 'Sudden death, swelling of head and comb, purple discoloration, respiratory distress, diarrhea',
      prevention: 'Vaccination (inactivated, LPAI areas only), strict biosecurity',
      treatment: 'No specific treatment; culling in HPAI cases',
      organicTreatments: 'None effective; strict biosecurity only',
    },
    {
      name: 'Salmonella',
      category: 'Bacterial',
      incubation: 'Variable',
      mortalityRate: 'Variable, higher in young chicks',
      symptoms: 'Diarrhea, weakness, huddling, poor growth, pasty vent',
      prevention: 'Vaccination of breeders, biosecurity, feed hygiene, rodent control',
      treatment: 'Broad-spectrum antibiotics as per vet recommendation',
      organicTreatments: 'Turmeric in water, basil leaf extract, probiotic supplements',
    },
    {
      name: 'E. coli Infection',
      category: 'Bacterial',
      incubation: 'Variable',
      mortalityRate: 'Variable',
      symptoms: 'Respiratory signs, airsacculitis, septicemia, swollen joints, diarrhea',
      prevention: 'Good management, biosecurity, clean environment, proper ventilation',
      treatment: 'Broad-spectrum antibiotics based on sensitivity testing',
      organicTreatments: 'Lime water, clove extract, sage infusion',
    },
    {
      name: 'Chronic Respiratory Disease (CRD)',
      category: 'Bacterial',
      incubation: 'Variable',
      mortalityRate: 'Low to moderate',
      symptoms: 'Nasal discharge, coughing, sneezing, swollen sinuses, reduced egg production',
      prevention: 'Biosecurity, vaccination, avoid stress, good ventilation',
      treatment: 'Tylosin, tetracyclines, fluoroquinolones (vet prescription)',
      organicTreatments: 'Garlic in water, oregano oil, echinacea',
    },
    {
      name: 'Fowl Pox',
      category: 'Viral',
      incubation: '4-14 days',
      mortalityRate: 'Low to moderate (higher with wet pox)',
      symptoms: 'Warty growths on comb, wattles, eyelids; reduced vision; respiratory distress (wet form)',
      prevention: 'Wing web vaccination, mosquito control, biosecurity',
      treatment: 'Supportive care, iodine on lesions, antibiotics for secondary infections',
      organicTreatments: 'Aloe vera gel on lesions, neem oil spray',
    },
  ];

  for (const disease of diseases) {
    await prisma.disease.upsert({
      where: { name: disease.name },
      update: {},
      create: disease,
    });
  }

  console.log('[SEED] Diseases:', diseases.length);
}
