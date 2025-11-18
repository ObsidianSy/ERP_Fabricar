import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Factory,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Settings,
  BarChart2,
  ChevronsUpDown,
  User2,
  Truck,
  LogOut,
  Activity,
  PackageX,
  Shield,
  Moon,
  Sun,
  CreditCard,
  TrendingUp,
  DollarSign
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface NavItem {
  title: string;
  url: string;
  icon: any;
  adminOnly?: boolean;
  permissao?: string; // Chave da permissão necessária
}

const data = {
  user: {
    name: "Administrador",
    email: "admin@obsidian.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: Factory,
      permissao: "dashboard.acessar",
    },
    {
      title: "Estoque",
      url: "/estoque",
      icon: Package,
      permissao: "estoque.visualizar",
      items: [
        {
          title: "Gerenciar Estoque",
          url: "/estoque",
        },
        {
          title: "Histórico de Entradas",
          url: "/historico-entradas",
        },
      ],
    },
    {
      title: "Vendas",
      url: "/vendas",
      icon: ShoppingCart,
      permissao: "vendas.visualizar",
    },
    {
      title: "Clientes",
      url: "/clientes",
      icon: Users,
      permissao: "clientes.visualizar",
    },
    {
      title: "Pagamentos",
      url: "/pagamentos",
      icon: Wallet,
      permissao: "pagamentos.visualizar",
    },
    {
      title: "Devoluções",
      url: "/devolucoes",
      icon: PackageX,
      permissao: "devolucoes.visualizar",
    },
    {
      title: "Receitas",
      url: "/receita-produto",
      icon: Settings,
      permissao: "receitas.visualizar",
    },
    {
      title: "Custos de Produtos",
      url: "/custos-produtos",
      icon: DollarSign,
      permissao: "custos.produtos.visualizar",
    },
    {
      title: "Relatórios",
      url: "/relatorios",
      icon: BarChart2,
      permissao: "relatorios.visualizar",
    },
    {
      title: "Import Planilha",
      url: "/import-planilha",
      icon: Package,
      permissao: "import.planilha",
    },
    {
      title: "Import Planilha Full",
      url: "/import-planilha-full",
      icon: Package,
      permissao: "import.planilha_full",
    },
    {
      title: "FULL Envios",
      url: "/full-envios",
      icon: Truck,
      permissao: "envios.visualizar",
    },
    {
      title: "Logs de Atividade",
      url: "/activity-logs",
      icon: Activity,
      adminOnly: true,
      permissao: "logs.visualizar",
    },
  ] as NavItem[],
  navFinanceiro: [
    {
      title: "Contas",
      url: "/financeiro/contas",
      icon: Wallet,
      permissao: "financeiro.visualizar",
    },
    {
      title: "Cartões",
      url: "/financeiro/cartoes",
      icon: CreditCard,
      permissao: "financeiro.visualizar",
    },
    {
      title: "Transações",
      url: "/financeiro/transacoes",
      icon: TrendingUp,
      permissao: "financeiro.visualizar",
    },
    {
      title: "Faturas",
      url: "/financeiro/faturas",
      icon: CreditCard,
      permissao: "financeiro.visualizar",
    },
  ] as NavItem[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const location = useLocation()
  const { usuario, logout, isAdmin, hasPermission } = useAuth()
  const { theme, setTheme } = useTheme()

  const isActive = (url: string) => {
    if (url === "/") {
      return location.pathname === "/"
    }
    return location.pathname === url || location.pathname.startsWith(`${url}/`)
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // Filtrar itens da navbar baseado em permissões
  const navItemsFiltrados = data.navMain.filter((item) => {
    // Se é adminOnly, verificar se é admin
    if (item.adminOnly && !isAdmin()) {
      return false;
    }

    // Se tem permissão específica, verificar se usuário tem
    if (item.permissao && !hasPermission(item.permissao)) {
      return false;
    }

    return true;
  });

  // Filtrar itens do financeiro baseado em permissões
  const navFinanceiroFiltrados = data.navFinanceiro.filter((item) => {
    // Se é adminOnly, verificar se é admin
    if (item.adminOnly && !isAdmin()) {
      return false;
    }

    // Se tem permissão específica, verificar se usuário tem
    if (item.permissao && !hasPermission(item.permissao)) {
      return false;
    }

    return true;
  });

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-sidebar-primary-foreground">
                <Factory className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Obs Fabrica</span>
                <span className="truncate text-xs">Sistema de Gestão</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItemsFiltrados.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive(item.url)}
                    className="transition-all hover:bg-accent/60"
                  >
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grupo Financeiro separado */}
        {navFinanceiroFiltrados.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navFinanceiroFiltrados.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.url)}
                      className="transition-all hover:bg-accent/60"
                    >
                      <NavLink to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Botão de alternância de tema */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              className="transition-all hover:bg-accent/60"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Modo Escuro</span>
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Menu do usuário */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={data.user.avatar} alt={usuario?.nome || data.user.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      <User2 className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{usuario?.nome || data.user.name}</span>
                    <span className="truncate text-xs">{usuario?.email || data.user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={state === "collapsed" ? "right" : "bottom"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem className="cursor-pointer">
                  <User2 />
                  Perfil
                </DropdownMenuItem>
                {isAdmin() && (
                  <>
                    <DropdownMenuItem className="cursor-pointer" asChild>
                      <NavLink to="/usuarios">
                        <Shield />
                        Gerenciar Usuários
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" asChild>
                      <NavLink to="/admin/permissoes">
                        <Shield />
                        Gerenciar Permissões
                      </NavLink>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem className="cursor-pointer">
                  <Settings />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={logout}
                >
                  <LogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}