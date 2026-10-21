"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Disease } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, HeartPulse, X } from "lucide-react";

export default function DiseasesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [filtered, setFiltered] = useState<Disease[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      apiFetch<Disease[]>("/api/v1/diseases")
        .then((d) => { setDiseases(d); setFiltered(d); setCategories(["All", ...Array.from(new Set(d.map((x) => x.category)))]); })
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    let result = diseases;
    if (selectedCategory !== "All") result = result.filter((d) => d.category === selectedCategory);
    if (search) result = result.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || (d.symptoms && d.symptoms.toLowerCase().includes(search.toLowerCase())));
    setFiltered(result);
  }, [search, selectedCategory, diseases]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Disease Database</h1>
        <p className="text-muted-foreground">Common poultry diseases, symptoms, prevention, and treatments</p>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search diseases or symptoms..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Badge key={cat} variant={selectedCategory === cat ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedCategory(cat)}>
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((disease) => (
          <Card key={disease.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDisease(disease)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{disease.name}</CardTitle>
                <Badge variant="secondary">{disease.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {disease.symptoms && <p className="text-sm text-muted-foreground line-clamp-2">{disease.symptoms}</p>}
              {disease.mortalityRate && <p className="text-sm text-red-600 mt-2">Mortality: {disease.mortalityRate}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && <div className="text-center py-12"><HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No diseases found matching your search.</p></div>}

      {selectedDisease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDisease(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedDisease.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedDisease.category}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDisease(null)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDisease.incubation && <div><h4 className="font-medium mb-1">Incubation</h4><p className="text-sm text-muted-foreground">{selectedDisease.incubation}</p></div>}
              {selectedDisease.mortalityRate && <div><h4 className="font-medium mb-1">Mortality Rate</h4><p className="text-sm text-red-600">{selectedDisease.mortalityRate}</p></div>}
              {selectedDisease.symptoms && <div><h4 className="font-medium mb-1">Symptoms</h4><p className="text-sm text-muted-foreground">{selectedDisease.symptoms}</p></div>}
              {selectedDisease.prevention && <div><h4 className="font-medium mb-1">Prevention</h4><p className="text-sm text-muted-foreground">{selectedDisease.prevention}</p></div>}
              {selectedDisease.treatment && <div><h4 className="font-medium mb-1">Treatment</h4><p className="text-sm text-muted-foreground">{selectedDisease.treatment}</p></div>}
              {selectedDisease.organicTreatments && <div><h4 className="font-medium mb-1 text-green-700">Organic Treatments</h4><p className="text-sm text-muted-foreground">{selectedDisease.organicTreatments}</p></div>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
