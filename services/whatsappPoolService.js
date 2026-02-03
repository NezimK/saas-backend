const supabaseService = require('./supabaseService');

/**
 * Service de gestion du pool de numéros WhatsApp Twilio
 * Assignation automatique des numéros aux tenants
 */
class WhatsAppPoolService {
  /**
   * Assigner automatiquement un numéro libre à un tenant
   * @param {string} tenantId - UUID du tenant
   * @returns {Object} { success, phoneNumber, alreadyAssigned, error }
   */
  async assignNumberToTenant(tenantId) {
    try {
      // Vérifier si le tenant a déjà un numéro assigné
      const { data: existingAssignment } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .select('phone_number')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existingAssignment) {
        console.log(`📱 Tenant ${tenantId} a déjà le numéro ${existingAssignment.phone_number}`);
        return {
          success: true,
          phoneNumber: existingAssignment.phone_number,
          alreadyAssigned: true
        };
      }

      // Trouver et assigner un numéro avec retry en cas de race condition
      const MAX_RETRIES = 3;
      let assignedNumber = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Trouver un numéro disponible (avec ordre deterministe)
        const { data: availableNumber, error: findError } = await supabaseService.supabase
          .from('whatsapp_numbers_pool')
          .select('*')
          .eq('status', 'available')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (findError) {
          console.error('Erreur recherche numéro disponible:', findError);
          return {
            success: false,
            error: 'Erreur lors de la recherche d\'un numéro disponible'
          };
        }

        if (!availableNumber) {
          console.warn(`⚠️ Aucun numéro WhatsApp disponible pour tenant ${tenantId}`);
          return {
            success: false,
            error: 'Aucun numéro WhatsApp disponible. Contactez le support pour en ajouter.'
          };
        }

        // Assigner le numéro au tenant (mise à jour atomique avec verification du count)
        const { data: updatedRows, error: updatePoolError } = await supabaseService.supabase
          .from('whatsapp_numbers_pool')
          .update({
            tenant_id: tenantId,
            status: 'assigned',
            assigned_at: new Date().toISOString()
          })
          .eq('id', availableNumber.id)
          .eq('status', 'available')
          .select();

        if (updatePoolError) {
          console.error('Erreur assignation pool:', updatePoolError);
          return {
            success: false,
            error: 'Erreur lors de l\'assignation du numéro'
          };
        }

        // Verifier qu'une ligne a bien ete modifiee
        if (updatedRows && updatedRows.length > 0) {
          assignedNumber = availableNumber;
          break; // Succes, sortir de la boucle
        }

        // Race condition detectee - le numero a ete pris par un autre tenant
        console.warn(`⚠️ Tentative ${attempt}/${MAX_RETRIES}: Numéro ${availableNumber.phone_number} déjà pris, retry...`);
      }

      if (!assignedNumber) {
        console.error(`❌ Impossible d'assigner un numéro après ${MAX_RETRIES} tentatives pour tenant ${tenantId}`);
        return {
          success: false,
          error: 'Impossible d\'assigner un numéro WhatsApp. Veuillez réessayer.'
        };
      }

      // Mettre à jour le tenant avec son numéro WhatsApp
      const { error: updateTenantError } = await supabaseService.supabase
        .from('tenants')
        .update({ whatsapp_number: assignedNumber.phone_number })
        .eq('tenant_id', tenantId);

      if (updateTenantError) {
        console.error('Erreur mise à jour tenant:', updateTenantError);
        // Ne pas bloquer, le numéro est assigné dans le pool
      }

      console.log(`✅ Numéro ${assignedNumber.phone_number} assigné au tenant ${tenantId}`);

      return {
        success: true,
        phoneNumber: assignedNumber.phone_number,
        alreadyAssigned: false
      };

    } catch (error) {
      console.error('Erreur assignNumberToTenant:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Libérer un numéro quand un tenant est supprimé ou désactivé
   * @param {string} tenantId - UUID du tenant
   * @returns {Object} { success, error }
   */
  async releaseNumber(tenantId) {
    try {
      const { error } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .update({
          tenant_id: null,
          status: 'available',
          assigned_at: null
        })
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Erreur libération numéro:', error);
        return { success: false, error: error.message };
      }

      // Nettoyer le numéro du tenant
      await supabaseService.supabase
        .from('tenants')
        .update({ whatsapp_number: null })
        .eq('tenant_id', tenantId);

      console.log(`🔓 Numéro libéré pour tenant ${tenantId}`);
      return { success: true };

    } catch (error) {
      console.error('Erreur releaseNumber:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir le statut complet du pool de numéros
   * @returns {Object} { success, total, available, assigned, numbers, error }
   */
  async getPoolStatus() {
    try {
      const { data, error } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .select(`
          id,
          phone_number,
          status,
          assigned_at,
          created_at,
          tenant_id
        `)
        .order('id', { ascending: true });

      if (error) {
        console.error('Erreur getPoolStatus:', error);
        return { success: false, error: error.message };
      }

      // Récupérer les infos des tenants associés
      const tenantIds = data.filter(n => n.tenant_id).map(n => n.tenant_id);
      let tenantsMap = {};

      if (tenantIds.length > 0) {
        const { data: tenants } = await supabaseService.supabase
          .from('tenants')
          .select('tenant_id, company_name, email')
          .in('tenant_id', tenantIds);

        if (tenants) {
          tenantsMap = tenants.reduce((acc, t) => {
            acc[t.tenant_id] = t;
            return acc;
          }, {});
        }
      }

      // Enrichir les données avec les infos tenant
      const numbersWithTenants = data.map(n => ({
        ...n,
        tenant: n.tenant_id ? tenantsMap[n.tenant_id] || null : null
      }));

      const available = data.filter(n => n.status === 'available').length;
      const assigned = data.filter(n => n.status === 'assigned').length;
      const suspended = data.filter(n => n.status === 'suspended').length;

      return {
        success: true,
        total: data.length,
        available,
        assigned,
        suspended,
        numbers: numbersWithTenants
      };

    } catch (error) {
      console.error('Erreur getPoolStatus:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ajouter un nouveau numéro au pool
   * @param {string} phoneNumber - Numéro au format E.164
   * @returns {Object} { success, error }
   */
  async addNumberToPool(phoneNumber) {
    try {
      // Normaliser le numéro
      let normalized = phoneNumber.trim().replace(/\s+/g, '');
      if (!normalized.startsWith('+')) {
        if (normalized.startsWith('0')) {
          normalized = '+33' + normalized.substring(1);
        } else {
          normalized = '+' + normalized;
        }
      }

      // Valider le format E.164
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(normalized)) {
        return {
          success: false,
          error: 'Format de numéro invalide. Utilisez +33612345678'
        };
      }

      const { error } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .insert({
          phone_number: normalized,
          status: 'available'
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          return { success: false, error: 'Ce numéro existe déjà dans le pool' };
        }
        return { success: false, error: error.message };
      }

      console.log(`➕ Numéro ${normalized} ajouté au pool`);
      return { success: true, phoneNumber: normalized };

    } catch (error) {
      console.error('Erreur addNumberToPool:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Suspendre un numéro (le retirer temporairement du pool)
   * @param {string} phoneNumber - Numéro au format E.164
   * @returns {Object} { success, error }
   */
  async suspendNumber(phoneNumber) {
    try {
      const { error } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .update({ status: 'suspended' })
        .eq('phone_number', phoneNumber);

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`⏸️ Numéro ${phoneNumber} suspendu`);
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Réactiver un numéro suspendu
   * @param {string} phoneNumber - Numéro au format E.164
   * @returns {Object} { success, error }
   */
  async reactivateNumber(phoneNumber) {
    try {
      // Vérifier s'il est assigné à un tenant
      const { data: number } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .select('tenant_id')
        .eq('phone_number', phoneNumber)
        .single();

      const newStatus = number?.tenant_id ? 'assigned' : 'available';

      const { error } = await supabaseService.supabase
        .from('whatsapp_numbers_pool')
        .update({ status: newStatus })
        .eq('phone_number', phoneNumber);

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`▶️ Numéro ${phoneNumber} réactivé (${newStatus})`);
      return { success: true, status: newStatus };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppPoolService();
