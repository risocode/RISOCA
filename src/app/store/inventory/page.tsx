'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  seedInventory,
} from '@/app/actions';
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
import {Skeleton} from '@/components/ui/skeleton';
import {useToast} from '@/hooks/use-toast';
import {
  ArrowLeft,
  PackageSearch,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShoppingCart,
} from 'lucide-react';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const {toast} = useToast();

  const form = useForm<InventoryItemInput>({
    resolver: zodResolver(InventoryItemSchema),
    defaultValues: {
      name: '',
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
        console.error('Error fetching inventory from Firestore:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch inventory data.',
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const handleOpenDialog = (item: InventoryItem | null = null) => {
    setEditingItem(item);
    if (item) {
      form.reset({
        name: item.name,
        price: item.price,
        stock: item.stock,
      });
    } else {
      form.reset({name: '', price: 0, stock: 0});
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
        title: `Item ${editingItem ? 'Updated' : 'Added'}`,
        description: `The item has been successfully ${
          editingItem ? 'updated' : 'added'
        }.`,
      });
      setIsDialogOpen(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
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
        title: 'Item Deleted',
        description: 'The item has been successfully deleted.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsAlertOpen(false);
    setDeletingItemId(null);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    const response = await seedInventory();
    if (response.success) {
      toast({
        title: 'Sample Data Added',
        description: response.message,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Seeding Failed',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSeeding(false);
  };

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/store">
            <ArrowLeft />
            <span className="sr-only">Back to Store</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            Add, edit, and manage your store's items.
          </p>
        </div>
      </header>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="w-5 h-5" /> All Items
            </CardTitle>
            <CardDescription>
              A list of all items currently in your inventory.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSeedData}
              disabled={isSeeding}
            >
              {isSeeding ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2" />
              )}
              {isSeeding ? 'Adding...' : 'Add Samples'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2" /> Add New Item
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Edit Item' : 'Add New Item'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingItem
                      ? "Update the item's details below."
                      : 'Fill in the details for the new item.'}
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
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., T-Shirt" {...field} />
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
                        {editingItem ? 'Save Changes' : 'Add Item'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({length: 5}).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-3/4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-1/2" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-1/3" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-20 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>₱{item.price.toFixed(2)}</TableCell>
                    <TableCell>{item.stock}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Pencil className="w-4 h-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenAlert(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No items in inventory. Add your first item to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              item from your inventory.
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
    </div>
  );
}
