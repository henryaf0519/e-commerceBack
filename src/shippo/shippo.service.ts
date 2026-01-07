/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DistanceUnitEnum, Shippo, WeightUnitEnum } from 'shippo';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShippoService {
  // 1. Inicializamos el Logger con el nombre del servicio
  private readonly logger = new Logger(ShippoService.name);
  private shippo: Shippo;

  constructor(private configService: ConfigService) {
    // 2. Usamos ConfigService para la API Key (Asegúrate de tener SHIPPO_KEY en tu .env)
    this.shippo = new Shippo({
      apiKeyHeader: this.configService.getOrThrow<string>('SHIPPO_KEY'),
    });
  }

  async createShipment(createShipmentDto: CreateShipmentDto) {
    this.logger.log('🚀 Creando nuevo envío y cotizando...');
    const payload = {
      addressFrom: {
        name: 'Shawn Ippotle',
        street1: '733 N Kedzie Ave',
        city: 'CHICAGO',
        state: 'IL',
        zip: '60612',
        country: 'US',
        phone: '4215559099',
        email: 'shippotle@goshippo.com',
      },
      ...createShipmentDto,
      parcels: [
        {
          length: '12.5',
          width: '6',
          height: '12.5',
          distanceUnit: DistanceUnitEnum.In,
          weight: '2',
          massUnit: WeightUnitEnum.Lb,
        },
      ],
    };

    try {
      const shipment = await this.shippo.shipments.create(payload);
      if (!shipment.rates || shipment.rates.length === 0) {
        throw new BadRequestException(
          'No se encontraron tarifas para esta ruta.',
        );
      }
      const sortedRates = shipment.rates.sort(
        (a, b) => parseFloat(a.amount) - parseFloat(b.amount),
      );

      const cleanRates = sortedRates.map((rate: any) => ({
        id: rate.objectId,
        provider: rate.provider,
        name: rate.servicelevel.name,
        image: rate.providerImage75,
        price: parseFloat(rate.amount),
        currency: rate.currency,
        days: rate.estimatedDays
          ? `${rate.estimatedDays} days`
          : 'Delivery time pending',
        duration: rate.durationTerms,
      }));

      this.logger.log(
        `✅ Cotización exitosa. ${cleanRates.length} opciones encontradas.`,
      );

      return {
        message: 'Cotización exitosa',
        shipmentId: shipment.objectId,
        rates: cleanRates, // ¡Ahora van ordenadas y limpias!
      };
    } catch (error) {
      this.logger.error(`❌ Error creando envío: ${error.message}`);
      throw error;
    }
  }

  async getTransaction(transactionId: string) {
    this.logger.log(`🔍 Buscando transacción: ${transactionId}`);

    try {
      const transaction = await this.shippo.transactions.get(transactionId);
      this.logger.log(
        `✅ Transacción encontrada. Estado: ${transaction.status}`,
      );
      return transaction;
    } catch (error) {
      this.logger.error(`❌ Error obteniendo transacción: ${error.message}`);
      throw error;
    }
  }

  async purchaseLabel(rateId: string) {
    this.logger.log(`💰 Comprando etiqueta para Rate ID: ${rateId}`);

    try {
      const transaction = await this.shippo.transactions.create({
        rate: rateId,
        labelFileType: 'PDF',
        async: false,
      });

      if (transaction.status !== 'SUCCESS') {
        const errorMsg =
          transaction.messages?.[0]?.text || 'Error desconocido en Shippo';
        this.logger.error(`❌ Falló la compra: ${errorMsg}`);
        throw new BadRequestException(
          `No se pudo generar la etiqueta: ${errorMsg}`,
        );
      }

      this.logger.log(
        `🎉 ¡Etiqueta generada! Tracking: ${transaction.trackingNumber}`,
      );

      // SOLUCIÓN AL ERROR DE TYPESCRIPT:
      // Verificamos si rate existe y si es un objeto (para acceder a provider)
      const rateInfo =
        transaction.rate && typeof transaction.rate !== 'string'
          ? transaction.rate
          : null;

      return {
        status: 'SUCCESS',
        message: 'Etiqueta comprada correctamente',
        transactionId: transaction.objectId,
        trackingNumber: transaction.trackingNumber,
        trackingUrl: transaction.trackingUrlProvider,
        labelUrl: transaction.labelUrl,
        carrier: rateInfo?.provider || 'Carrier',
        eta: transaction.eta || 'Pendiente',
      };
    } catch (error) {
      this.logger.error(`❌ Error en transacción: ${error.message}`);
      throw error;
    }
  }

  async trackShipment(trackingNumber: string, carrier: string) {
    this.logger.log(`🔍 Rastreando paquete: ${trackingNumber} (${carrier})`);

    try {
      const status = await this.shippo.trackingStatus.get(
        trackingNumber,
        carrier,
      );

      const currentStatus = status.trackingStatus;

      return {
        trackingNumber: status.trackingNumber,
        carrier: status.carrier,
        status: currentStatus?.status,
        statusDetails: currentStatus?.statusDetails,
        eta: status.eta,
        location: currentStatus?.location
          ? `${currentStatus.location.city || ''}, ${currentStatus.location.state || ''}`
          : 'Localización no disponible',
        history: status.trackingHistory?.map((event) => ({
          date: event.statusDate,
          status: event.status,
          location: event.location
            ? `${event.location.city}, ${event.location.state}`
            : 'N/A',
          details: event.statusDetails,
        })),
      };
    } catch (error) {
      this.logger.error(`❌ Error al rastrear: ${error.message}`);
      throw new BadRequestException('No se pudo obtener el estado de rastreo.');
    }
  }
}
