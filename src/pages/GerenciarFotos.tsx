import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import FotosProdutos from './FotosProdutos';
import FotosMateriaPrima from './FotosMateriaPrima';

const GerenciarFotos: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('produtos');

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate('/estoque')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Gerenciar Fotos</h1>
                        <p className="text-muted-foreground mt-2">
                            Adicione e gerencie fotos de produtos e matérias-primas
                        </p>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="produtos">Produtos</TabsTrigger>
                    <TabsTrigger value="materias-primas">Matérias-Primas</TabsTrigger>
                </TabsList>

                <TabsContent value="produtos" className="space-y-4">
                    <FotosProdutos />
                </TabsContent>

                <TabsContent value="materias-primas" className="space-y-4">
                    <FotosMateriaPrima />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default GerenciarFotos;
