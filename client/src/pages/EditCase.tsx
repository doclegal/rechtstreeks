import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCase, useUpdateCase } from "@/hooks/useCase";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const editCaseSchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().min(10, "Beschrijving moet minimaal 10 karakters bevatten"),
  category: z.string().min(1, "Selecteer een categorie"),
  claimAmount: z.string().optional(),
  userRole: z.enum(["EISER", "GEDAAGDE"]),
  claimantName: z.string().optional(),
  claimantAddress: z.string().optional(),
  claimantCity: z.string().min(1, "Woonplaats is verplicht voor het bepalen van bevoegdheid"),
  counterpartyType: z.enum(["individual", "company"]),
  counterpartyName: z.string().min(1, "Naam wederpartij is verplicht"),
  counterpartyEmail: z.string().email("Ongeldig emailadres").optional().or(z.literal("")),
  counterpartyPhone: z.string().optional(),
  counterpartyAddress: z.string().optional(),
  counterpartyCity: z.string().min(1, "Woonplaats/vestigingsplaats is verplicht voor het bepalen van bevoegdheid"),
});

type EditCaseFormData = z.infer<typeof editCaseSchema>;

export default function EditCase() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/edit-case/:id");
  const caseId = params?.id || "";
  const { toast } = useToast();
  
  const { data: caseData, isLoading } = useCase(caseId);
  const updateCaseMutation = useUpdateCase(caseId);
  
  const form = useForm<EditCaseFormData>({
    resolver: zodResolver(editCaseSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      claimAmount: "",
      userRole: "EISER",
      claimantName: "",
      claimantAddress: "",
      claimantCity: "",
      counterpartyType: "individual",
      counterpartyName: "",
      counterpartyEmail: "",
      counterpartyPhone: "",
      counterpartyAddress: "",
      counterpartyCity: "",
    },
  });

  // Update form when case data loads
  useEffect(() => {
    if (caseData) {
      form.reset({
        title: caseData.title || "",
        description: caseData.description || "",
        category: caseData.category || "",
        claimAmount: caseData.claimAmount || "",
        userRole: caseData.userRole || "EISER",
        claimantName: caseData.claimantName || "",
        claimantAddress: caseData.claimantAddress || "",
        claimantCity: caseData.claimantCity || "",
        counterpartyType: caseData.counterpartyType || "individual",
        counterpartyName: caseData.counterpartyName || "",
        counterpartyEmail: caseData.counterpartyEmail || "",
        counterpartyPhone: caseData.counterpartyPhone || "",
        counterpartyAddress: caseData.counterpartyAddress || "",
        counterpartyCity: caseData.counterpartyCity || "",
      });
    }
  }, [caseData, form]);

  const onSubmit = (data: EditCaseFormData) => {
    updateCaseMutation.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Zaak bijgewerkt",
          description: "Uw zaakgegevens zijn succesvol bijgewerkt.",
        });
        setLocation("/my-case");
      },
      onError: () => {
        toast({
          title: "Fout",
          description: "Er is een fout opgetreden bij het bijwerken van uw zaak.",
          variant: "destructive",
        });
      }
    });
  };

  const categories = [
    "Contractrecht",
    "Arbeidsrecht", 
    "Huurrecht",
    "Consumentenrecht",
    "Schadevergoeding",
    "Overig"
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground mb-4">Zaak niet gevonden</h2>
        <Button onClick={() => setLocation("/my-case")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar overzicht
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/my-case")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zaak bewerken</h1>
          <p className="text-muted-foreground">Pas uw zaakgegevens aan</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5 text-primary" />
              <span>Zaak gegevens</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Titel van de zaak *</Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder="Korte beschrijving van uw zaak"
                data-testid="input-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Beschrijving *</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Uitgebreide beschrijving van uw situatie, wat er is gebeurd en wat u wilt bereiken"
                rows={4}
                data-testid="textarea-description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div>
              <Label>Uw rol in deze zaak *</Label>
              <Select 
                value={form.watch("userRole")} 
                onValueChange={(value) => form.setValue("userRole", value as "EISER" | "GEDAAGDE")}
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EISER">Eiser (u stelt een vordering in)</SelectItem>
                  <SelectItem value="GEDAAGDE">Gedaagde (u wordt aangesproken)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Bepaal uw rol in deze juridische zaak. Als eiser bent u degene die de claim indient. Als gedaagde wordt u aangesproken door de wederpartij.
              </p>
              {form.formState.errors.userRole && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.userRole.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categorie *</Label>
                <Select 
                  value={form.watch("category")} 
                  onValueChange={(value) => form.setValue("category", value)}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecteer categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.category.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="claimAmount">Claim bedrag (€)</Label>
                <Input
                  id="claimAmount"
                  {...form.register("claimAmount")}
                  placeholder="15000"
                  type="number"
                  step="0.01"
                  data-testid="input-claim-amount"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="claimantName">Naam</Label>
              <Input
                id="claimantName"
                {...form.register("claimantName")}
                placeholder="Voor- en achternaam"
                data-testid="input-claimant-name"
              />
            </div>

            <div>
              <Label htmlFor="claimantAddress">Adres</Label>
              <Input
                id="claimantAddress"
                {...form.register("claimantAddress")}
                placeholder="Straat 123, 1234 AB"
                data-testid="input-claimant-address"
              />
            </div>

            <div>
              <Label htmlFor="claimantCity">Woonplaats *</Label>
              <Input
                id="claimantCity"
                {...form.register("claimantCity")}
                placeholder="Amsterdam"
                data-testid="input-claimant-city"
              />
              {form.formState.errors.claimantCity && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.claimantCity.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Counterparty Information */}
        <Card>
          <CardHeader>
            <CardTitle>Wederpartij gegevens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Type wederpartij *</Label>
              <Select 
                value={form.watch("counterpartyType")} 
                onValueChange={(value) => form.setValue("counterpartyType", value as "individual" | "company")}
              >
                <SelectTrigger data-testid="select-counterparty-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Particulier</SelectItem>
                  <SelectItem value="company">Bedrijf</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="counterpartyName">
                {form.watch("counterpartyType") === "company" ? "Bedrijfsnaam" : "Naam"} *
              </Label>
              <Input
                id="counterpartyName"
                {...form.register("counterpartyName")}
                placeholder={form.watch("counterpartyType") === "company" ? "Bedrijf B.V." : "Voor- en achternaam"}
                data-testid="input-counterparty-name"
              />
              {form.formState.errors.counterpartyName && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.counterpartyName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="counterpartyEmail">Email</Label>
                <Input
                  id="counterpartyEmail"
                  {...form.register("counterpartyEmail")}
                  placeholder="email@voorbeeld.nl"
                  type="email"
                  data-testid="input-counterparty-email"
                />
                {form.formState.errors.counterpartyEmail && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.counterpartyEmail.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="counterpartyPhone">Telefoon</Label>
                <Input
                  id="counterpartyPhone"
                  {...form.register("counterpartyPhone")}
                  placeholder="06-12345678"
                  data-testid="input-counterparty-phone"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="counterpartyAddress">Adres</Label>
              <Textarea
                id="counterpartyAddress"
                {...form.register("counterpartyAddress")}
                placeholder="Straat 123, 1234 AB"
                rows={2}
                data-testid="textarea-counterparty-address"
              />
            </div>

            <div>
              <Label htmlFor="counterpartyCity">
                {form.watch("counterpartyType") === "company" ? "Vestigingsplaats *" : "Woonplaats *"}
              </Label>
              <Input
                id="counterpartyCity"
                {...form.register("counterpartyCity")}
                placeholder="Rotterdam"
                data-testid="input-counterparty-city"
              />
              {form.formState.errors.counterpartyCity && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.counterpartyCity.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setLocation("/my-case")}
            data-testid="button-cancel"
          >
            Annuleren
          </Button>
          <Button 
            type="submit" 
            disabled={updateCaseMutation.isPending}
            data-testid="button-save"
          >
            {updateCaseMutation.isPending ? "Opslaan..." : "Wijzigingen opslaan"}
          </Button>
        </div>
      </form>
    </div>
  );
}