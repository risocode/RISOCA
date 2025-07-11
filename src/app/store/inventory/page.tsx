
'use client';

import {useState, useEffect, useMemo} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {collection, query, onSnapshot, orderBy} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '@/app/actions/inventory.actions';
import {
  InventoryItemSchema,
  type InventoryItemInput,
  type InventoryItem,
} from '@/lib/schemas';

import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Skeleton} from '@/components/ui/skeleton';
import {useToast} from '@/hooks/use-toast';
import {
  PackageSearch,
  Plus,
  Trash2,
  Loader2,
  Search,
} from 'lucide-react';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  const {toast} = useToast();

  const form = useForm<InventoryItemInput>({
    resolver: zodResolver(InventoryItemSchema),
    defaultValues: {
      name: '',
      cost: 0,
      price: 0,
      stock: 0,
    },
  });

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'inventory'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const itemsFromDb: InventoryItem[] = [];
        querySnapshot.forEach((doc) => {
          itemsFromDb.push({
            id: doc.id,
            ...(doc.data() as Omit<InventoryItem, 'id'>),
          });
        });
        setItems(itemsFromDb);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching products from Firestore:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch products.',
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const displayedItems = useMemo(() => {
    const filtered = searchTerm
      ? items.filter((item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [...items];

    switch (sortOption) {
      case 'name-asc':
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case 'price-high':
        return filtered.sort((a, b) => b.price - a.price);
      case 'price-low':
        return filtered.sort((a, b) => a.price - b.price);
      default:
        return filtered;
    }
  }, [items, searchTerm, sortOption]);

  const handleOpenDialog = (item: InventoryItem | null = null) => {
    setEditingItem(item);
    if (item) {
      form.reset({
        name: item.name,
        cost: item.cost || 0,
        price: item.price,
        stock: item.stock,
      });
    } else {
      form.reset({name: '', cost: 0, price: 0, stock: 0});
    }
    setIsDialogOpen(true);
  };

  const handleFormSubmit = async (data: InventoryItemInput) => {
    setIsSubmitting(true);
    const action = editingItem
      ? updateInventoryItem(editingItem.id, data)
      : addInventoryItem(data);

    const response = await action;

    if (response.success) {
      toast({
        variant: 'success',
        title: `Product ${editingItem ? 'Updated' : 'Added'}`,
      });
      setIsDialogOpen(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };

  const handleOpenAlert = (id: string) => {
    setDeletingItemId(id);
    setIsAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItemId) return;

    const response = await deleteInventoryItem(deletingItemId);

    if (response.success) {
      toast({
        variant: 'destructive',
        title: 'Product Deleted',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsAlertOpen(false);
    setDeletingItemId(null);
  };

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4 opacity-0 animate-page-enter">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Products</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Edit Product' : 'Add New Product'}
                </DialogTitle>
                <DialogDescription>
                  {editingItem
                    ? "Update the product's details below."
                    : 'Fill in the details for the new product.'}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleFormSubmit)}
                  className="space-y-4 py-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., T-Shirt" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cost"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>Cost (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="100.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>Price (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="150.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Stock Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="mr-2 animate-spin" />
                      )}
                      {editingItem ? 'Save Changes' : 'Add Product'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-grow">
                <CardTitle className="flex items-center gap-2">
                  <PackageSearch className="w-5 h-5" /> All Products
                </CardTitle>
                <CardDescription>
                  A list of all products currently in your inventory.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search products..."
                    className="pl-10 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">A-Z</SelectItem>
                    <SelectItem value="default">Date Added</SelectItem>
                    <SelectItem value="price-high">
                      Price: High to Low
                    </SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 md:px-4">Product Name</TableHead>
                  <TableHead className="text-right px-2 md:px-4">Price</TableHead>
                  <TableHead className="text-center px-2 md:px-4">
                    Stock
                  </TableHead>
                  <TableHead className="text-right px-2 md:px-4">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({length: 5}).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-2 md:p-4">
                          <Skeleton className="h-5 w-3/4" />
                        </TableCell>
                        <TableCell className="p-2 md:p-4">
                          <Skeleton className="h-5 w-1/2 ml-auto" />
                        </TableCell>
                        <TableCell className="p-2 md:p-4">
                          <Skeleton className="h-5 w-1/3 mx-auto" />
                        </TableCell>
                        <TableCell className="text-right p-2 md:p-4">
                          <Skeleton className="h-8 w-10 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  : displayedItems.length > 0
                  ? displayedItems.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={() => handleOpenDialog(item)}
                        className="cursor-pointer"
                      >
                        <TableCell className="p-2 md:p-4 font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="p-2 md:p-4 whitespace-nowrap text-right font-mono">
                          ₱{item.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2 md:p-4 text-center">
                          {item.stock}
                        </TableCell>
                        <TableCell className="p-2 md:p-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAlert(item.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  : !isLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          {searchTerm
                            ? `No products found for "${searchTerm}"`
                            : 'No products yet. Add your first one to get started.'}
                        </TableCell>
                      </TableRow>
                    )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingItemId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
