import { BuscadorAlimentos } from '@/components/nutricion/BuscadorAlimentos';
import { useAuth } from '@/hooks/useAuth';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { emitNutricionLogActualizado } from '@/lib/nutricionEvents';
import { alimentosService } from '@/services/alimentos.service';
import { nutricionService } from '@/services/nutricion.service';
import type { Food } from '@/types/database.types';
import { router, useLocalSearchParams } from 'expo-router';

export default function AgregarAlimento() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    mealId?: string;
    fecha?: string;
  }>();
  const mealId = typeof params.mealId === 'string' ? params.mealId : params.mealId?.[0];
  const fechaRaw = typeof params.fecha === 'string' ? params.fecha : params.fecha?.[0];
  const fechaLog = fechaRaw && fechaRaw.length > 0 ? fechaRaw : fechaHoyIsoLocal();

  const agregarAlimento = async (food: Food, gramos: number) => {
    if (!mealId || !user?.id) return;

    const foodReal = await alimentosService.asegurarFoodParaLog(food);
    await nutricionService.añadirAlimentoAComida({
      mealId,
      foodId: foodReal.id,
      gramos,
      food: {
        calorias: Number(foodReal.calorias ?? 0),
        proteinas: Number(foodReal.proteinas ?? 0),
        carbohidratos: Number(foodReal.carbohidratos ?? 0),
        grasas: Number(foodReal.grasas ?? 0),
      },
    });
    emitNutricionLogActualizado({ fechaLog });
  };

  return (
    <BuscadorAlimentos
      visible
      onClose={() => router.back()}
      onAlimentoSeleccionado={agregarAlimento}
      userId={user?.id}
    />
  );
}
