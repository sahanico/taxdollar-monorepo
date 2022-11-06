<template>
  <div :style="{ height: `${formHeight}px`, padding: '16px' }">
    <v-dialog v-model="createdDialog" width="400">
      <v-card>
        <v-card-title class="headline red white--text" dark
                      primary-title> Design record has been saved!
        </v-card-title>
        <v-spacer></v-spacer>
        <v-btn color="black" text type="button"
               @click="createdDialog = false">Ok
        </v-btn>
      </v-card>
    </v-dialog>
    <v-dialog v-model="inputsDialog" width="400">
      <v-card>
        <v-card-title class="headline red white--text" dark
                      primary-title> Select inputs
        </v-card-title>
        <v-container v-if="design.meta && design.meta.inputs && design.meta.inputs.length > 0">
          <v-row v-for="(item, index) in design.meta.inputs" :key="index">
            <v-col vols="12" md="12">
              <div v-if="item.type === 'object'">
                <v-autocomplete v-model="pool[item.name]" :items="getObjectRecords(item.object)" />
              </div>
            </v-col>
          </v-row>
        </v-container>
        <v-spacer></v-spacer>
        <v-btn color="black" text type="button"
               @click="processInputs">Ok
        </v-btn>
      </v-card>
    </v-dialog>
    <div class="headline red--text pt-2 mt-2 pb-2 mb-2">
      {{ design && design.meta && design.meta.showLabel ? design.label : '' }}
    </div>
    <v-progress-linear  v-show="loading" color="red" indeterminate />
    <v-card :style="{ height: `${formHeight + 48}px` }">
      <form ref="configExecution" lazy-validation @submit.prevent="onSubmit" style="padding: 16px">
        <div>
          <div>
            <div id="content">
              <grid-layout
                :layout.sync="layout" :col-num=parseInt(column)
                :row-height=parseInt(height)
                :is-draggable="false" :is-resizable="false" :responsive="false"
                :vertical-compact="true" :prevent-collision="true" :use-css-transforms="true"
                ref="gridlayout">
                <grid-item v-for="(item,index) in layout" :key="index"
                           :static="item.static"
                           :x="item.x" :y="item.y" :w="item.w" :h="item.h" :i="item.i">
                  <fields :name="`form-field-${item.value.name}`" v-model="form[item.value.name]"
                          :form="form" :design="design" :root-form-field-index="index"
                          :item="item" @updateHeight="updateHeight"
                          context="create"></fields>
                </grid-item>
              </grid-layout>
            </div>
          </div>
        </div>
        <br />
        <br />
        <v-btn :style="{ position: 'absolute', bottom: '16px', left: '16px' }"
               color="red darken-2" dark type="submit">Create
        </v-btn>
      </form>
    </v-card>
  </div>
</template>
<script>
import { GridLayout, GridItem } from 'vue-grid-layout';
import { _ } from 'vue-underscore';
import VueSignaturePad from 'vue-signature-pad';
import Fields from '../fields/fields';

export default {
  components: {
    GridLayout,
    GridItem,
    VueSignaturePad,
    Fields,
  },
  props: ['formName'],
  data() {
    return {
      pool: {},
      form: {},
      layout: [],
      column: 0,
      height: 0,
      design: {},
      objects: {},
      menu: false,
      loading: true,
      date: new Date().toISOString()
        .substr(0, 10),
      createdDialog: false,
      inputsDialog: false,
      object: null,
      callback: {
        onError(error) {
          // eslint-disable-next-line no-console
          console.log('error', error);
        },
        onDeclined(response) {
          // eslint-disable-next-line no-console
          console.log('declined', JSON.stringify(response));
        },
        onApproval(response) {
          // eslint-disable-next-line no-console
          console.log('approval', JSON.stringify(response));
        },
      },
    };
  },
  computed: {
    formHeight() {
      let total = 0;
      const maxHeight = [];
      _.each(this.layout, (item) => {
        maxHeight[item.y] = item.h;
      });
      total = maxHeight.reduce((a, b) => a + b, 0);
      return (total) * this.height;
    },
  },
  methods: {
    updateHeight(value, index) {
      this.layout[index].h = Math.ceil(value / this.height);
    },
    processInputs() {
      _.each(_.keys(this.pool), (key) => {
        const object = _.findWhere(this.objects, { name: key });
        const objectRecords = _.where(this.records, { object: key });
        // const record = _.findWhere(this.records, {
        //   object: key,
        //   [`data.${object.primaryField}`]: this.pool[key],
        let record;
        _.each(objectRecords, (rec) => {
          if (rec.data[object.primaryField] === this.pool[key]) record = rec;
        });
        // });
        _.each(this.design.meta.layout, (item) => {
          if (item.value.meta && item.value.meta.default && item.value.meta.default.type === 'input') {
            if (item.value.meta.default.input && item.value.meta.default.input.name === key) {
              if (record.data[item.value.meta.default.input.field]) {
                this.form[item.value.name] = record.data[item.value.meta.default.input.field];
              }
            }
          }
        });
      });
      this.inputsDialog = false;
    },
    getObjectRecords(name) {
      const object = _.findWhere(this.objects, { name });
      const records = _.where(this.records, { object: name });
      return _.map(records, record => record.data[object.primaryField]);
    },
    async onSubmit() {
      const defaultValues = {};
      // populate defaultValues map
      _.each(this.object.fields, (field) => {
        if (field.meta && field.meta.default) {
          defaultValues[field.name] = field.meta.default;
        }
      });

      _.each(this.design.meta.hiddenFields, (field) => {
        if (field.name) {
          this.form[field.name] = '';
        }
        if (defaultValues[field.name]) {
          if (field.type === 'number' && field.meta.autoIncrement) {
            this.form[field.name] = parseInt(defaultValues[field.name], 10);
          } else {
            this.form[field.name] = defaultValues[field.name];
          }
        }
      });
      const record = {
        object: this.design.object,
        data: this.form,
      };
      // todo : get response from backend, if unique field data already exists, show dialog

      const createRecord = await this.$store.dispatch('createRecord', record);

      if (record.data.attachments) {
        if (createRecord) {
          const fd = new FormData();
          const paths = [];
          Array.prototype.forEach.call(record.data.attachments, (file) => {
            fd.append(file.name, file);
            paths.push(`/${file.name}`);
          });
          const fileData = {
            recordId: createRecord.id,
            path: paths,
          };
          fd.append('record', fileData.recordId);
          fd.append('path', fileData.path);
          await this.$store.dispatch('uploadAttachment', fd);
        }
      }
      this.createdDialog = true;
      if (this.design.object === 'payment') {
        const paymentData = {
          ssl_transaction_type: 'ccsale',
          ssl_merchant_id: '2150532',
          ssl_user_id: 'taxdollarapi',
          ssl_pin: 'YT9OUUYZ6GWWVRSR5K3BQNX6U1FW4HUWR4H2QHZ8TYNKGV0NG9B3MMETVOKZBSWY',
          ssl_amount: 1.01,
        };
        const sessionToken = await this.$store.dispatch('postSessionToken', paymentData);

        const paymentData2 = {
          ssl_txn_auth_token: sessionToken,
          ssl_card_number: '4538263839347025',
          ssl_exp_date: '0424',
          ssl_cvv2cvc2: '717',
          ssl_get_token: 'Y',
          ssl_add_token: 'Y',
          ssl_first_name: 'Mradul',
          ssl_last_name: 'Sahani',
          ssl_merchant_txn_id: '2150532',
          ssl_avs_address: '129 Upper Humber Drive',
          ssl_avs_zip: 'M9W 7B7',
        };

        // const transaction = await this.$store.dispatch('postHostedPaymentPage', paymentData);
        // eslint-disable-next-line no-undef
        ConvergeEmbeddedPayment.pay(paymentData2, this.callback);
      }
      this.$emit('submitForm', createRecord.id);
      this.form = {};
    },
    getData(data) {
      this.form = data;
    },
  },
  async created() {
    this.design = await this.$store.dispatch('getDesignByName', {
      name: this.formName,
    });
    this.objects = await this.$store.dispatch('getAllObjects');
    this.records = await this.$store.dispatch('getAllRecords');
    const objectName = this.design.object;
    this.object = _.findWhere(this.objects, {
      name: objectName,
    });
    const defaultValues = {};
    // populate defaultValues map
    _.each(this.object.fields, (field) => {
      if (field.meta && field.meta.default) {
        defaultValues[field.name] = field.meta.default;
      }
    });
    // add default values to form if they exist
    _.each(this.design.meta.layout, (field) => {
      if (field.value.name && defaultValues[field.value.name]) {
        this.form[field.value.name] = defaultValues[field.value.name];
      }
    });
    this.layout = this.design.meta.layout;
    this.column = this.design.meta.column;
    this.height = this.design.meta.height;
    if (this.design.meta && this.design.meta.inputs.length > 0) {
      if (_.any(this.design.meta.inputs, input => input.type === 'object')) {
        this.inputsDialog = true;
      }
    }
    this.loading = false;
  },
};
</script>
<style scoped>

.vue-signature {
  border: 1px solid black;
  border-radius: 10px;
}

#signature {
  border: 1px solid #ccc;
  border-radius: 5px;
  background-image: linear-gradient(white, white),
  radial-gradient(circle at top left, #4bc5e8, #9f6274);
  background-origin: border-box;
  background-clip: content-box, border-box;
}
</style>
