"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BreedsTab } from "@/components/catalogue/breeds-tab";
import { DiseasesTab } from "@/components/catalogue/diseases-tab";
import { SchedulesTab } from "@/components/catalogue/schedules-tab";
import { TargetsTab } from "@/components/catalogue/targets-tab";
import { TemplatesTab } from "@/components/catalogue/templates-tab";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CataloguePage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!hasPermission("catalogue.write")) {
      router.replace("/");
    }
  }, [user, isLoading, hasPermission, router]);

  if (isLoading || !user) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Catalogue</h1>
        <p className="text-muted-foreground">
          Global reference data shared by all tenants — diseases, breeds, vaccination schedules,
          performance targets and supplier-category templates
        </p>
      </div>

      <Tabs defaultValue="diseases">
        <TabsList>
          <TabsTrigger value="diseases">Diseases</TabsTrigger>
          <TabsTrigger value="breeds">Breeds</TabsTrigger>
          <TabsTrigger value="vaccination-schedules">Vaccination Schedules</TabsTrigger>
          <TabsTrigger value="performance-targets">Performance Targets</TabsTrigger>
          <TabsTrigger value="supplier-category-templates">Category Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="diseases" className="pt-4">
          <DiseasesTab />
        </TabsContent>
        <TabsContent value="breeds" className="pt-4">
          <BreedsTab />
        </TabsContent>
        <TabsContent value="vaccination-schedules" className="pt-4">
          <SchedulesTab />
        </TabsContent>
        <TabsContent value="performance-targets" className="pt-4">
          <TargetsTab />
        </TabsContent>
        <TabsContent value="supplier-category-templates" className="pt-4">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
