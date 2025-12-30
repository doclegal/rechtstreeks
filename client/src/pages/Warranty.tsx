import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Shield, Plus, Upload, FileText, Calendar, Euro, Package, ExternalLink, Trash2, Edit, Download, ImageIcon, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// Form schema for adding products
const productSchema = z.object({
  productName: z.string().min(1, "Productnaam is verplicht"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  supplier: z.string().optional(),
  warrantyDuration: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  notes: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

// Mock data for MVP - replace with real API calls later
const mockProducts = [
  {
    id: "1",
    productName: "Samsung Galaxy Smartphone",
    brand: "Samsung",
    model: "Galaxy S24",
    serialNumber: "SN123456789",
    purchaseDate: "2024-01-15",
    purchasePrice: "899.00",
    supplier: "MediaMarkt",
    warrantyDuration: "2 jaar",
    warrantyExpiry: "2026-01-15",
    category: "electronics",
    status: "active",
    websiteUrl: "https://samsung.com/nl/smartphones/galaxy-s24",
    documents: [
      { id: "1", filename: "aankoopbon_samsung.pdf", documentType: "receipt" },
      { id: "2", filename: "garantie_samsung.pdf", documentType: "warranty" },
    ]
  },
  {
    id: "2", 
    productName: "Dyson Stofzuiger V15",
    brand: "Dyson",
    model: "V15 Detect",
    serialNumber: "DY987654321",
    purchaseDate: "2023-11-20",
    purchasePrice: "649.00",
    supplier: "Coolblue",
    warrantyDuration: "2 jaar",
    warrantyExpiry: "2025-11-20",
    category: "appliances",
    status: "active",
    documents: [
      { id: "3", filename: "bon_dyson.jpg", documentType: "receipt" },
      { id: "4", filename: "garantie_dyson.pdf", documentType: "warranty" },
      { id: "5", filename: "handleiding_dyson.pdf", documentType: "manual" },
    ]
  }
];

export default function Warranty() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState(mockProducts);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productName: "",
      brand: "",
      model: "",
      serialNumber: "",
      purchaseDate: "",
      purchasePrice: "",
      supplier: "",
      warrantyDuration: "2 jaar",
      category: "",
      description: "",
      websiteUrl: "",
      notes: "",
    },
  });

  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productName: "",
      brand: "",
      model: "",
      serialNumber: "",
      purchaseDate: "",
      purchasePrice: "",
      supplier: "",
      warrantyDuration: "2 jaar",
      category: "",
      description: "",
      websiteUrl: "",
      notes: "",
    },
  });

  const onSubmit = (data: ProductFormData) => {
    // TODO: Replace with actual API call
    console.log("Adding product:", data);
    
    // Calculate warranty expiry if purchase date and duration are provided
    let warrantyExpiry = undefined;
    if (data.purchaseDate && data.warrantyDuration) {
      const purchaseDate = new Date(data.purchaseDate);
      const duration = data.warrantyDuration;
      if (duration.includes('jaar')) {
        const years = parseInt(duration);
        warrantyExpiry = new Date(purchaseDate.setFullYear(purchaseDate.getFullYear() + years)).toISOString().split('T')[0];
      } else if (duration.includes('maand')) {
        const months = parseInt(duration);
        warrantyExpiry = new Date(purchaseDate.setMonth(purchaseDate.getMonth() + months)).toISOString().split('T')[0];
      }
    }

    const newProduct = {
      id: Math.random().toString(),
      productName: data.productName,
      brand: data.brand || "",
      model: data.model || "",
      serialNumber: data.serialNumber || "",
      purchaseDate: data.purchaseDate || "",
      purchasePrice: data.purchasePrice || "",
      supplier: data.supplier || "",
      warrantyDuration: data.warrantyDuration || "",
      warrantyExpiry: warrantyExpiry || "",
      category: data.category || "",
      description: data.description || "",
      websiteUrl: data.websiteUrl || "",
      notes: data.notes || "",
      status: "active",
      documents: []
    };
    
    setProducts([...products, newProduct]);
    
    toast({
      title: "Product toegevoegd",
      description: "Het product is succesvol toegevoegd aan uw garantie overzicht.",
    });
    
    form.reset();
    setIsAddDialogOpen(false);
  };

  // Handle product editing
  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    
    // Pre-populate the edit form with existing product data
    editForm.setValue('productName', product.productName || '');
    editForm.setValue('brand', product.brand || '');
    editForm.setValue('model', product.model || '');
    editForm.setValue('serialNumber', product.serialNumber || '');
    editForm.setValue('purchaseDate', product.purchaseDate || '');
    editForm.setValue('purchasePrice', product.purchasePrice || '');
    editForm.setValue('supplier', product.supplier || '');
    editForm.setValue('warrantyDuration', product.warrantyDuration || '2 jaar');
    editForm.setValue('category', product.category || '');
    editForm.setValue('description', product.description || '');
    editForm.setValue('websiteUrl', product.websiteUrl || '');
    editForm.setValue('notes', product.notes || '');
    
    setIsEditDialogOpen(true);
  };

  // Handle saving edited product
  const onEditSubmit = (data: ProductFormData) => {
    if (!editingProduct) return;
    
    console.log("Updating product:", editingProduct.id, data);
    
    // Calculate warranty expiry if purchase date and duration are provided
    let warrantyExpiry = editingProduct.warrantyExpiry;
    if (data.purchaseDate && data.warrantyDuration) {
      const purchaseDate = new Date(data.purchaseDate);
      const duration = data.warrantyDuration;
      if (duration.includes('jaar')) {
        const years = parseInt(duration);
        warrantyExpiry = new Date(purchaseDate.setFullYear(purchaseDate.getFullYear() + years)).toISOString().split('T')[0];
      } else if (duration.includes('maand')) {
        const months = parseInt(duration);
        warrantyExpiry = new Date(purchaseDate.setMonth(purchaseDate.getMonth() + months)).toISOString().split('T')[0];
      }
    }

    const updatedProduct = {
      ...editingProduct,
      productName: data.productName,
      brand: data.brand || "",
      model: data.model || "",
      serialNumber: data.serialNumber || "",
      purchaseDate: data.purchaseDate || "",
      purchasePrice: data.purchasePrice || "",
      supplier: data.supplier || "",
      warrantyDuration: data.warrantyDuration || "",
      warrantyExpiry: warrantyExpiry || "",
      category: data.category || "",
      description: data.description || "",
      websiteUrl: data.websiteUrl || "",
      notes: data.notes || "",
    };
    
    setProducts(products.map(p => p.id === editingProduct.id ? updatedProduct : p));
    
    toast({
      title: "Product bijgewerkt",
      description: "De productgegevens zijn succesvol bijgewerkt.",
    });
    
    editForm.reset();
    setEditingProduct(null);
    setIsEditDialogOpen(false);
  };

  // Handle product deletion
  const handleDeleteProduct = (product: any) => {
    if (window.confirm(`Weet je zeker dat je "${product.productName}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      setProducts(products.filter(p => p.id !== product.id));
      
      toast({
        title: "Product verwijderd",
        description: `"${product.productName}" is verwijderd uit je garantie overzicht.`,
        variant: "destructive",
      });
    }
  };

  // NEW: Handle receipt upload and AI extraction
  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDF)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Ongeldig bestandstype",
        description: "Alleen afbeeldingen en PDF bestanden zijn toegestaan (JPG, PNG, GIF, WEBP, PDF)",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Bestand te groot",
        description: "Maximale bestandsgrootte is 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingReceipt(true);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('receipt', file);

      // Call the AI extraction API
      const response = await fetch('/api/warranty/extract-receipt', {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        // Parse error response to get user-friendly message
        let errorMessage = "Er is een onbekende fout opgetreden";
        try {
          const errorResponse = await response.json();
          errorMessage = errorResponse.message || errorMessage;
        } catch (e) {
          // Fallback to status text if JSON parsing fails
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        }
        
        // Map specific error types to user-friendly messages
        if (response.status === 429) {
          errorMessage = "Te veel extracties. Wacht 10 minuten tussen bonanalyses.";
        } else if (response.status === 422) {
          // For unprocessable entity, use the server message or provide helpful fallback
          if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
            errorMessage = "OpenAI API quota bereikt. Probeer het later opnieuw of vul de gegevens handmatig in.";
          } else if (!errorMessage || errorMessage.includes('Upload failed')) {
            errorMessage = "Kon geen betrouwbare gegevens uit de bon extraheren. Probeer een duidelijkere foto of vul handmatig in.";
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success && result.extractedData) {
        const extracted = result.extractedData;
        
        // Auto-populate form fields with extracted data
        form.setValue('productName', extracted.productName || '');
        form.setValue('brand', extracted.brand || '');
        form.setValue('model', extracted.model || '');
        form.setValue('purchaseDate', extracted.purchaseDate || '');
        form.setValue('purchasePrice', extracted.purchasePrice || '');
        form.setValue('supplier', extracted.supplier || '');
        form.setValue('warrantyDuration', extracted.warrantyDuration || '');
        form.setValue('category', extracted.category || '');
        form.setValue('description', extracted.description || '');

        toast({
          title: "Gegevens geëxtraheerd! 🎉",
          description: result.message || `Aankoopgegevens automatisch ingevuld uit ${file.name}. Controleer en pas aan waar nodig.`,
        });
      } else {
        throw new Error(result.message || 'Extractie mislukt');
      }
    } catch (error) {
      console.error('Receipt upload error:', error);
      
      // Ensure loading state is cleared before showing toast
      setIsUploadingReceipt(false);
      
      // Get the error message and show toast
      const errorMessage = error instanceof Error ? error.message : "Kon geen gegevens uit de bon halen";
      
      console.log('Showing error toast with message:', errorMessage);
      
      toast({
        title: "Extractie mislukt",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Ensure loading state is definitely cleared
      setIsUploadingReceipt(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "expired": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "claimed": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "electronics": return "📱";
      case "appliances": return "🏠";
      case "tools": return "🔧";
      case "automotive": return "🚗";
      default: return "📦";
    }
  };

  const isWarrantyExpiring = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffInMonths = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return diffInMonths <= 3 && diffInMonths > 0;
  };

  const isWarrantyExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    return expiry < now;
  };

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-64">Laden...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Inloggen vereist
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Log in om uw aankopen en garanties te beheren.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3" data-testid="title-warranty">
            <Shield className="h-8 w-8 text-primary" />
            Aankoop en garantie
          </h1>
          <p className="text-muted-foreground mt-2">
            Beheer uw aankoopbewijzen en garantiedocumenten. Upload documenten zodat u later 
            eenvoudig garantie kunt claimen met AI-ondersteuning.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" data-testid="button-add-product">
              <Plus className="h-4 w-4" />
              Product toevoegen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nieuw product toevoegen</DialogTitle>
            </DialogHeader>
            
            {/* AI Receipt Upload Section */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-800">
              <ImageIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Upload aankoopbon voor automatische extractie
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload een foto van uw aankoopbon om automatisch de productgegevens in te vullen
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={handleReceiptUpload}
                className="hidden"
                data-testid="input-receipt-upload"
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingReceipt}
                className="mb-2"
                data-testid="button-upload-receipt"
              >
                {isUploadingReceipt ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Bezig met analyseren...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Selecteer aankoopbon
                  </>
                )}
              </Button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ondersteunde formaten: JPG, PNG, GIF, WEBP, PDF (max. 10MB)
              </p>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">
                  Of vul handmatig in
                </span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Productnaam *</FormLabel>
                        <FormControl>
                          <Input placeholder="bijv. Samsung Galaxy S24" {...field} data-testid="input-product-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merk</FormLabel>
                        <FormControl>
                          <Input placeholder="bijv. Samsung" {...field} data-testid="input-brand" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="bijv. Galaxy S24" {...field} data-testid="input-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serienummer</FormLabel>
                        <FormControl>
                          <Input placeholder="bijv. SN123456789" {...field} data-testid="input-serial" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aankoopdatum</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-purchase-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aankoopprijs (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="899.00" {...field} data-testid="input-purchase-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverancier</FormLabel>
                        <FormControl>
                          <Input placeholder="bijv. MediaMarkt" {...field} data-testid="input-supplier" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garantieduur</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger data-testid="select-warranty-duration">
                              <SelectValue placeholder="Selecteer duur" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1 jaar">1 jaar</SelectItem>
                              <SelectItem value="2 jaar">2 jaar</SelectItem>
                              <SelectItem value="3 jaar">3 jaar</SelectItem>
                              <SelectItem value="5 jaar">5 jaar</SelectItem>
                              <SelectItem value="levenslang">Levenslang</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categorie</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Selecteer categorie" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="electronics">Elektronica</SelectItem>
                              <SelectItem value="appliances">Huishoudelijke apparaten</SelectItem>
                              <SelectItem value="tools">Gereedschap</SelectItem>
                              <SelectItem value="automotive">Auto & Motor</SelectItem>
                              <SelectItem value="furniture">Meubels</SelectItem>
                              <SelectItem value="other">Overig</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website/productpagina</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} data-testid="input-website" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschrijving</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Optionele beschrijving van het product..."
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notities</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Persoonlijke notities..."
                          {...field} 
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Annuleren
                  </Button>
                  <Button type="submit" data-testid="button-save-product">
                    Product opslaan
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Product Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Product bewerken</DialogTitle>
            </DialogHeader>
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Productnaam *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="bijv. Samsung Galaxy S24" 
                            {...field} 
                            data-testid="input-edit-product-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merk</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="bijv. Samsung" 
                            {...field} 
                            data-testid="input-edit-brand"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="bijv. Galaxy S24" 
                            {...field} 
                            data-testid="input-edit-model"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serienummer</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="bijv. SN123456789" 
                            {...field} 
                            data-testid="input-edit-serial-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aankoopdatum</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-edit-purchase-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aankoopprijs (€)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="bijv. 899.00" 
                            {...field} 
                            data-testid="input-edit-purchase-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverancier</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="bijv. MediaMarkt" 
                            {...field} 
                            data-testid="input-edit-supplier"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="warrantyDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garantieduur</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-warranty-duration">
                              <SelectValue placeholder="Selecteer duur" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1 jaar">1 jaar</SelectItem>
                            <SelectItem value="2 jaar">2 jaar</SelectItem>
                            <SelectItem value="3 jaar">3 jaar</SelectItem>
                            <SelectItem value="5 jaar">5 jaar</SelectItem>
                            <SelectItem value="levenslang">Levenslang</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categorie</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-category">
                              <SelectValue placeholder="Selecteer categorie" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="electronics">Elektronica</SelectItem>
                            <SelectItem value="appliances">Huishoudelijk apparaat</SelectItem>
                            <SelectItem value="clothing">Kleding</SelectItem>
                            <SelectItem value="tools">Gereedschap</SelectItem>
                            <SelectItem value="automotive">Auto/Motor</SelectItem>
                            <SelectItem value="home">Huis/Tuin</SelectItem>
                            <SelectItem value="sports">Sport/Fitness</SelectItem>
                            <SelectItem value="other">Anders</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://..." 
                            {...field} 
                            data-testid="input-edit-website-url"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschrijving</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Extra productinformatie..."
                          {...field} 
                          data-testid="textarea-edit-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notities</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Persoonlijke notities..."
                          {...field} 
                          data-testid="textarea-edit-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    data-testid="button-edit-cancel"
                  >
                    Annuleren
                  </Button>
                  <Button type="submit" data-testid="button-save-edit">
                    Wijzigingen opslaan
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Overview */}
      <div className="grid gap-6">
        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Geen producten gevonden</h3>
              <p className="text-muted-foreground mb-4">
                Voeg uw eerste product toe om uw garanties te beheren.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-product">
                <Plus className="h-4 w-4 mr-2" />
                Eerste product toevoegen
              </Button>
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getCategoryIcon(product.category)}</div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-product-name-${product.id}`}>
                        {product.productName}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {product.brand && (
                          <Badge variant="outline" data-testid={`text-brand-${product.id}`}>
                            {product.brand}
                          </Badge>
                        )}
                        {product.model && (
                          <Badge variant="outline" data-testid={`text-model-${product.id}`}>
                            {product.model}
                          </Badge>
                        )}
                        <Badge 
                          className={getStatusColor(product.status)}
                          data-testid={`text-status-${product.id}`}
                        >
                          {product.status === 'active' ? 'Actief' : 
                           product.status === 'expired' ? 'Verlopen' : 'Geclaimed'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.websiteUrl && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(product.websiteUrl, '_blank')}
                        data-testid={`button-website-${product.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditProduct(product)}
                      data-testid={`button-edit-${product.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteProduct(product)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Aankoopdatum</Label>
                    <p className="text-sm font-medium" data-testid={`text-purchase-date-${product.id}`}>
                      {product.purchaseDate ? format(new Date(product.purchaseDate), 'dd MMM yyyy', { locale: nl }) : 'Onbekend'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Prijs</Label>
                    <p className="text-sm font-medium" data-testid={`text-price-${product.id}`}>
                      {product.purchasePrice ? `€${product.purchasePrice}` : 'Onbekend'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Leverancier</Label>
                    <p className="text-sm font-medium" data-testid={`text-supplier-${product.id}`}>
                      {product.supplier || 'Onbekend'}
                    </p>
                  </div>
                </div>

                {/* Warranty Status */}
                {product.warrantyExpiry && (
                  <div className={`p-3 rounded-lg mb-4 ${
                    isWarrantyExpired(product.warrantyExpiry) 
                      ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' 
                      : isWarrantyExpiring(product.warrantyExpiry)
                      ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800'
                      : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                  } border`}>
                    <div className="flex items-center gap-2">
                      <Shield className={`h-4 w-4 ${
                        isWarrantyExpired(product.warrantyExpiry) 
                          ? 'text-red-600' 
                          : isWarrantyExpiring(product.warrantyExpiry)
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`} />
                      <span className="text-sm font-medium">
                        Garantie {product.warrantyDuration} - 
                        Geldig tot {format(new Date(product.warrantyExpiry), 'dd MMM yyyy', { locale: nl })}
                      </span>
                    </div>
                    {isWarrantyExpiring(product.warrantyExpiry) && !isWarrantyExpired(product.warrantyExpiry) && (
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Garantie verloopt binnenkort!
                      </p>
                    )}
                    {isWarrantyExpired(product.warrantyExpiry) && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        Garantie is verlopen
                      </p>
                    )}
                  </div>
                )}

                {/* Documents */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm font-medium">Documenten ({product.documents?.length || 0})</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid={`button-upload-docs-${product.id}`}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  {product.documents && product.documents.length > 0 ? (
                    <div className="space-y-2">
                      {product.documents.map((doc: any) => (
                        <div 
                          key={doc.id} 
                          className="flex items-center justify-between p-2 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm" data-testid={`text-doc-name-${doc.id}`}>
                              {doc.filename}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {doc.documentType === 'receipt' ? 'Bon' :
                               doc.documentType === 'warranty' ? 'Garantie' :
                               doc.documentType === 'terms' ? 'Voorwaarden' :
                               doc.documentType === 'manual' ? 'Handleiding' : 'Overig'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-download-${doc.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nog geen documenten geüpload
                    </p>
                  )}
                </div>

                {/* Warranty Help Button */}
                {!isWarrantyExpired(product.warrantyExpiry || '') && (
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      className="w-full"
                      variant="default"
                      data-testid={`button-warranty-help-${product.id}`}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Help Garantie nodig
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}