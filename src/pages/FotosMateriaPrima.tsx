import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface MateriaPrimaFoto {
    sku_mp: string;
    foto_url: string;
    foto_filename: string;
    foto_size: number;
    nome: string;
    categoria: string;
    created_at: string;
    updated_at: string;
}

interface MateriaPrima {
    sku_mp: string;
    nome: string;
    categoria: string;
}

const FotosMateriaPrima: React.FC = () => {
    const [materiaPrimas, setMateriaPrimas] = useState<MateriaPrima[]>([]);
    const [fotosMateriaPrima, setFotosMateriaPrima] = useState<MateriaPrimaFoto[]>([]);
    const [selectedSku, setSelectedSku] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            // Carregar matérias-primas
            const resMp = await fetch(`${API_BASE_URL}/api/materia-prima`);
            const dataMp = await resMp.json();
            setMateriaPrimas(dataMp);

            // Carregar fotos existentes
            const resFotos = await fetch(`${API_BASE_URL}/api/materia-prima-fotos`);
            const dataFotos = await resFotos.json();
            setFotosMateriaPrima(dataFotos);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar os dados',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validar tipo de arquivo
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                toast({
                    title: 'Erro',
                    description: 'Tipo de arquivo não permitido. Use apenas JPG, PNG ou WEBP.',
                    variant: 'destructive',
                });
                return;
            }

            // Validar tamanho (5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    title: 'Erro',
                    description: 'Arquivo muito grande. Tamanho máximo: 5MB',
                    variant: 'destructive',
                });
                return;
            }

            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedSku || !selectedFile) {
            toast({
                title: 'Erro',
                description: 'Selecione uma matéria-prima e um arquivo',
                variant: 'destructive',
            });
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('foto', selectedFile);
            formData.append('sku_mp', selectedSku);

            const response = await fetch(`${API_BASE_URL}/api/materia-prima-fotos`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Erro ao fazer upload');
            }

            toast({
                title: 'Sucesso',
                description: 'Foto enviada com sucesso!',
            });

            // Limpar formulário
            setSelectedSku('');
            setSelectedFile(null);

            // Recarregar dados
            await carregarDados();
        } catch (error) {
            console.error('Erro ao fazer upload:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível fazer o upload da foto',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (sku: string) => {
        if (!confirm('Deseja realmente remover esta foto?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/materia-prima-fotos/${sku}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Erro ao remover foto');
            }

            toast({
                title: 'Sucesso',
                description: 'Foto removida com sucesso!',
            });

            await carregarDados();
        } catch (error) {
            console.error('Erro ao remover foto:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível remover a foto',
                variant: 'destructive',
            });
        }
    };

    const getFotoUrl = (foto: MateriaPrimaFoto) => {
        return `${API_BASE_URL}${foto.foto_url}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Card de Upload */}
            <Card>
                <CardHeader>
                    <CardTitle>Upload de Foto - Matéria-Prima</CardTitle>
                    <CardDescription>
                        Envie fotos das matérias-primas (JPG, PNG ou WEBP até 5MB)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sku">Matéria-Prima</Label>
                            <select
                                id="sku"
                                className="w-full p-2 border rounded-md"
                                value={selectedSku}
                                onChange={(e) => setSelectedSku(e.target.value)}
                            >
                                <option value="">Selecione uma matéria-prima</option>
                                {materiaPrimas.map((mp) => (
                                    <option key={mp.sku_mp} value={mp.sku_mp}>
                                        {mp.sku_mp} - {mp.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="foto">Arquivo da Foto</Label>
                            <Input
                                id="foto"
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                onChange={handleFileChange}
                            />
                            {selectedFile && (
                                <p className="text-sm text-muted-foreground">
                                    Arquivo selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                                </p>
                            )}
                        </div>

                        <Button
                            onClick={handleUpload}
                            disabled={!selectedSku || !selectedFile || uploading}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Enviar Foto
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Card de Fotos Cadastradas */}
            <Card>
                <CardHeader>
                    <CardTitle>Fotos Cadastradas</CardTitle>
                    <CardDescription>
                        {fotosMateriaPrima.length} matérias-primas com fotos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {fotosMateriaPrima.map((foto) => (
                            <div
                                key={foto.sku_mp}
                                className="border rounded-lg p-4 space-y-3"
                            >
                                <div className="flex items-center justify-center">
                                    <Avatar className="h-32 w-32">
                                        <AvatarImage
                                            src={getFotoUrl(foto)}
                                            alt={foto.nome}
                                        />
                                        <AvatarFallback className="text-2xl">
                                            {foto.nome.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold">{foto.sku_mp}</p>
                                    <p className="text-sm text-muted-foreground">{foto.nome}</p>
                                    <p className="text-xs text-muted-foreground">{foto.categoria}</p>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleDelete(foto.sku_mp)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remover
                                </Button>
                            </div>
                        ))}
                    </div>

                    {fotosMateriaPrima.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            Nenhuma foto cadastrada ainda
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default FotosMateriaPrima;
